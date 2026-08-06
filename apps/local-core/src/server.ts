import { createHash, randomUUID, timingSafeEqual } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { tmpdir } from 'node:os'
import { basename, isAbsolute, join } from 'node:path'

import type {
  Artifact,
  ArtifactView,
  Checkpoint,
  ContractError,
  BuildContextManifestV0Input,
  AcceptArtifactReturnInput,
  AgentExecutionPlanV1,
  MutationBatch,
  Note,
  Project,
  ProjectGraphSnapshot,
  ProjectCatalog,
  Relation,
  RegisterTrustedSourceInput,
  Workspace,
  ValidateProjectRootInput,
  CreateRunProposal,
  CommandDraftV1,
  ProviderSessionBindingV1,
  ImportResourceResultV1,
  CreateConversationImportSessionInputV1,
  CompleteConversationImportInputV1,
  ImportManualConversationInputV1,
  AnnotateConversationSectionInputV1,
  PinConversationMessageInputV1,
  BuildConversationSemanticIndexInputV1,
  CanvasObservationV1,
  RunEvent,
} from '@local-creative-os/contracts'
import type { ArtifactReturnId, ArtifactRevisionId, ArtifactViewId, FileRecordId, ProjectId, RunId, WorkspaceId } from '@local-creative-os/domain'

import { failure } from './errors.js'
import { getHealthStatus } from './health.js'
import { ExplicitProjectCatalog } from './project-catalog.js'
import { createProjectRoot, rollbackCreatedProjectRoot, validateProjectRoot } from './project-root.js'
import { MetadataForeignKeyConstraintError, SqliteMetadataRepository } from './metadata-repository.js'
import { FileRegistryService } from './file-registry-service.js'
import { FileObservationService } from './file-observation-service.js'
import { PreviewCacheService } from './preview-cache-service.js'
import { PreviewWorkerService } from './preview-worker-service.js'
import { ImportCopyConflictError, ImportCopyService } from './import-copy-service.js'
import { UniversalResourceImportService } from './resources/universal-resource-import-service.js'
import { ResourcePackageConflictError, ResourcePackageService } from './resources/resource-package-service.js'
import { ResourceUploadSessionService } from './resources/resource-upload-session-service.js'
import { ResourceReader } from './resources/resource-reader.js'
import { ResourceMatcher } from './resources/resource-matcher.js'
import { ContextManifestService } from './context-manifest-service.js'
import { RuntimeReviewService } from './runtime-review-service.js'
import { proposeRun, validateAgentExecutionPlan } from './runtime-proposal-service.js'
import { RuntimeRevisionCompareService } from './runtime-revision-compare-service.js'
import { WorkspaceStateService } from './workspace-state-service.js'
import { ProcessProjectionService } from './process-projection-service.js'
import { LcosprojService } from './lcosproj-service.js'
import { createTextArtifact } from './text-artifact-service.js'
import { planCodexDispatch } from './codex-dispatch-service.js'
import {
  RuntimeApplicationService,
  type CreateRuntimeRunInput,
} from './runtime-application-service.js'
import { ActiveContextConflictError, ActiveContextStore, type ActiveContextInput } from './active-context-store.js'
import { handleRuntimeReviewRoute } from './routes/runtime-reviews.js'
import { handleCanvasRoute } from './routes/canvas.js'
import { handleContextProposalsRoute } from './routes/context-proposals.js'
import { handleConversationsRoute } from './routes/conversations.js'
import { handleLcosprojRoute } from './routes/lcosproj.js'
import { handleProjectsRoute } from './routes/projects.js'
import { handleRunsRoute } from './routes/runs.js'
import { handleArtifactsRoute } from './routes/artifacts.js'
import { handleWorkspaceStatesRoute } from './routes/workspace-states.js'
import { ContextProposalStore } from './context-proposal-store.js'
import { selectNativeDirectory, type DirectoryPickerInput, type DirectoryPickerResult } from './native-directory-picker.js'
import { indexProjectRoot, inspectProjectRoot } from './project-root-indexer.js'
import { ObsidianConnectorSessionStore, ObsidianReadOnlyConnector } from './connectors/obsidian-connector.js'
import { ResourceConnectorRegistry } from './connectors/connector-port.js'
import { ConversationImportService } from './conversation-import-service.js'

const LOOPBACK_HOST = '127.0.0.1'
const MAX_BODY_BYTES = 1 * 1024 * 1024 // 1 MiB
const MAX_IMPORT_BODY_BYTES = 26 * 1024 * 1024 // 25 MiB file + multipart overhead
const MAX_DOCUMENT_PREVIEW_BYTES = 50 * 1024 * 1024
const MAX_LCOSPROJ_BODY_BYTES = 128 * 1024 * 1024
const FORBIDDEN_BROWSER_PATH_FIELDS = new Set(['path', 'absolutePath', 'targetPath', 'observedPath', 'rootPath'])

function isAbsolutePath(value: string): boolean {
  return isAbsolute(value)
}

function internalBridgeOrigin(): string {
  const value = process.env.LCOS_BRIDGE_URL ?? 'http://127.0.0.1:43122'
  const url = new URL(value)
  if (!['127.0.0.1', 'localhost', '[::1]', '::1'].includes(url.hostname)) {
    throw new Error('Light Bridge must use a loopback URL.')
  }
  return url.origin
}

async function bridgeProxy(path: string, input: { readonly method?: string; readonly body?: unknown }, signal: AbortSignal): Promise<{ readonly status: number; readonly body: unknown }> {
  const response = await fetch(new URL(path, `${internalBridgeOrigin()}/`), {
    method: input.method ?? 'GET',
    signal,
    headers: { accept: 'application/json', ...(input.body === undefined ? {} : { 'content-type': 'application/json' }) },
    ...(input.body === undefined ? {} : { body: JSON.stringify(input.body) }),
  })
  const body = await response.json().catch(() => ({ ok: false, error: { code: 'BRIDGE_PROTOCOL_ERROR', message: `Light Bridge returned HTTP ${response.status}.` } }))
  return { status: response.status, body }
}
function publicResourceImportResult(value: ImportResourceResultV1): ImportResourceResultV1 {
  return {
    resourceId: value.resourceId,
    artifactId: value.artifactId,
    revisionId: value.revisionId,
    ...(value.viewId === undefined ? {} : { viewId: value.viewId }),
    sourceKind: value.sourceKind,
    understandingStatus: value.understandingStatus,
    ...(value.descriptor === undefined ? {} : { descriptor: value.descriptor }),
  }
}

export const LOCAL_CORE_DEV_PORT = 43121

function createProjectId(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24) || 'project'
  return `project-${slug}-${randomUUID().slice(0, 8)}`
}

export interface LocalCoreServerOptions {
  readonly host?: string
  readonly port?: number
  readonly catalog?: ProjectCatalog
  readonly allowedRoot?: string
  readonly requestTimeoutMs?: number
  readonly metadataRepository?: SqliteMetadataRepository
  readonly fileRegistryService?: FileRegistryService
  readonly fileObservationService?: FileObservationService
  readonly previewWorkerService?: PreviewWorkerService
  readonly importCopyService?: ImportCopyService
  readonly resourceImportService?: UniversalResourceImportService
  readonly resourcePackageService?: ResourcePackageService
  readonly resourceReader?: ResourceReader
  readonly resourceMatcher?: ResourceMatcher
  readonly contextManifestService?: ContextManifestService
  readonly runtimeReviewService?: RuntimeReviewService
  readonly runtimeApplicationService?: RuntimeApplicationService
  readonly previewCacheRoot?: string
  readonly activeContextStore?: ActiveContextStore
  readonly contextProposalStore?: ContextProposalStore
  readonly apiToken?: string
  readonly allowedOrigins?: readonly string[]
  readonly directoryPicker?: (input: DirectoryPickerInput) => Promise<DirectoryPickerResult>
  readonly obsidianConnector?: ObsidianReadOnlyConnector
  readonly obsidianSessions?: ObsidianConnectorSessionStore
  readonly connectorRegistry?: ResourceConnectorRegistry
  readonly conversationImportService?: ConversationImportService
}

export interface LocalCoreAddress {
  readonly host: typeof LOOPBACK_HOST
  readonly port: number
}

export interface LocalCoreServer {
  start(signal?: AbortSignal): Promise<LocalCoreAddress>
  close(): Promise<void>
  address(): LocalCoreAddress | undefined
}

function sendJson(response: ServerResponse, statusCode: number, value: unknown): void {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  response.end(JSON.stringify(value))
}


function sendBinary(response: ServerResponse, statusCode: number, bytes: Buffer, fileName: string, contentType = 'application/octet-stream'): void {
  const asciiName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_') || 'download.bin'
  response.writeHead(statusCode, {
    'content-type': contentType,
    'content-length': String(bytes.length),
    'content-disposition': `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    'cache-control': 'no-store',
  })
  response.end(bytes)
}

function formatMetadataError(error: unknown, fallback: string): string {
  if (error instanceof MetadataForeignKeyConstraintError) {
    const context = error.context
    const fkCheck = context.foreignKeyCheck
      .map((row) => `${row.table}:${row.rowid}->${row.parent}#${row.fkid}`)
      .join(',') || 'none'
    return [
      error.message,
      `operation=${context.operationType}`,
      `entity=${context.entityId}`,
      `table=${context.table}`,
      `field=${context.foreignKeyColumn}`,
      `referenced=${context.referencedTable}:${context.referencedId}`,
      `statement=${context.statement}`,
      `foreign_key_check=${fkCheck}`,
    ].join(' | ')
  }
  return error instanceof Error ? error.message : fallback
}

async function readJsonBody(request: IncomingMessage, signal: AbortSignal): Promise<unknown> {
  return JSON.parse((await readRawBody(request, signal, MAX_BODY_BYTES)).toString('utf8'))
}

async function readRawBody(request: IncomingMessage, signal: AbortSignal, maxBytes: number): Promise<Buffer> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    if (signal.aborted) throw new DOMException('Request aborted', 'AbortError')
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > maxBytes) throw new RangeError('Request body is too large')
    chunks.push(buffer)
  }
  return Buffer.concat(chunks)
}

interface MultipartFilePart {
  readonly fileName: string
  readonly contentType: string
  readonly bytes: Buffer
}

interface MultipartImportBody {
  readonly fields: Record<string, string>
  readonly file: MultipartFilePart
}

function decodeMultipartFileName(headerText: string): string | undefined {
  const encoded = /filename\*\s*=\s*UTF-8''([^;\r\n]+)/i.exec(headerText)?.[1]?.trim()
  if (encoded !== undefined) {
    try { return decodeURIComponent(encoded) } catch { throw new Error('Multipart filename* is not valid UTF-8.') }
  }
  const legacy = /filename="([^"]*)"/i.exec(headerText)?.[1]
  if (legacy === undefined || !/[\x80-\xff]/.test(legacy)) return legacy
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.from(legacy, 'latin1'))
  } catch {
    return legacy
  }
}

function parseMultipartImport(contentType: string | undefined, body: Buffer): MultipartImportBody {
  const boundary = /boundary=([^;]+)/i.exec(contentType ?? '')?.[1]?.replace(/^"|"$/g, '')
  if (!boundary) throw new Error('Multipart boundary is required.')
  const raw = body.toString('latin1')
  const parts = raw.split(`--${boundary}`).slice(1, -1)
  const fields: Record<string, string> = {}
  let file: MultipartFilePart | undefined
  for (const part of parts) {
    const normalized = part.replace(/^\r\n/, '').replace(/\r\n$/, '')
    const separator = normalized.indexOf('\r\n\r\n')
    if (separator < 0) continue
    const headerText = normalized.slice(0, separator)
    const contentText = normalized.slice(separator + 4)
    const name = /name="([^"]+)"/i.exec(headerText)?.[1]
    if (!name) continue
    const fileName = decodeMultipartFileName(headerText)
    if (fileName !== undefined) {
      const contentTypeHeader = /content-type:\s*([^\r\n]+)/i.exec(headerText)?.[1]?.trim() ?? 'application/octet-stream'
      file = { fileName, contentType: contentTypeHeader, bytes: Buffer.from(contentText, 'latin1') }
    } else {
      fields[name] = Buffer.from(contentText, 'latin1').toString('utf8')
    }
  }
  if (file === undefined) throw new Error('Multipart import requires file.')
  return { fields, file }
}

async function withAbort<Value>(operation: Promise<Value>, signal: AbortSignal): Promise<Value> {
  if (signal.aborted) throw new DOMException('Operation aborted', 'AbortError')

  let abort: (() => void) | undefined
  const aborted = new Promise<never>((_resolve, reject) => {
    abort = () => reject(new DOMException('Operation aborted', 'AbortError'))
    signal.addEventListener('abort', abort, { once: true })
  })

  try {
    return await Promise.race([operation, aborted])
  } finally {
    if (abort !== undefined) signal.removeEventListener('abort', abort)
  }
}

function statusForError(code: string): number {
  if (code === 'PROJECT_ROOT_NOT_FOUND' || code === 'NOT_FOUND') return 404
  if (code === 'UNAVAILABLE') return 503
  if (code === 'ABORTED') return 499
  if (code === 'STALE_GRAPH_VERSION') return 409
  return 400
}

function requireMetadata(metadata: SqliteMetadataRepository | undefined, response: ServerResponse): metadata is SqliteMetadataRepository {
  if (metadata === undefined) {
    sendJson(response, 503, failure('UNAVAILABLE', 'Metadata repository is not configured.'))
    return false
  }
  return true
}

function requireProject(projectId: string, metadata: SqliteMetadataRepository, response: ServerResponse): Project | undefined {
  const project = metadata.getProject(projectId)
  if (project === undefined) {
    sendJson(response, 404, failure('NOT_FOUND', 'Project not found.'))
    return undefined
  }
  return project
}

export function createLocalCoreServer(options: LocalCoreServerOptions = {}): LocalCoreServer {
  const host = options.host ?? LOOPBACK_HOST
  if (host !== LOOPBACK_HOST) {
    throw new Error('Local Core may only bind to 127.0.0.1.')
  }
  const requestTimeoutMs = options.requestTimeoutMs ?? 10_000
  const apiToken = options.apiToken
  const allowedOrigins = new Set(options.allowedOrigins ?? ['http://127.0.0.1:5173', 'http://localhost:5173'])
  if (!Number.isFinite(requestTimeoutMs) || requestTimeoutMs <= 0) {
    throw new Error('Local Core requestTimeoutMs must be a positive finite number.')
  }

  const catalog = options.catalog ?? new ExplicitProjectCatalog([])
  const metadata = options.metadataRepository
  const fileRegistry = options.fileRegistryService
  const fileObservation = options.fileObservationService ?? (metadata === undefined ? undefined : new FileObservationService(metadata))
  const importCopy = options.importCopyService ?? (metadata === undefined ? undefined : new ImportCopyService(metadata))
  const resources = options.resourceImportService ?? (metadata === undefined || importCopy === undefined ? undefined : new UniversalResourceImportService(metadata, importCopy))
  const packages = options.resourcePackageService ?? (metadata === undefined ? undefined : new ResourcePackageService(metadata))
  const uploads = metadata === undefined || packages === undefined ? undefined : new ResourceUploadSessionService(metadata, packages)
  const resourceReader = options.resourceReader ?? (metadata === undefined ? undefined : new ResourceReader(metadata))
  const matcher = options.resourceMatcher ?? new ResourceMatcher()
  const contextManifest = options.contextManifestService ?? (metadata === undefined ? undefined : new ContextManifestService(metadata))
  const runtimeReview = options.runtimeReviewService ?? (metadata === undefined ? undefined : new RuntimeReviewService(metadata))
  const runtimeApplication = options.runtimeApplicationService
  const activeContext = options.activeContextStore ?? new ActiveContextStore(metadata)
  const contextProposals = options.contextProposalStore ?? new ContextProposalStore(metadata)
  const runEventListeners = new Map<string, Set<() => void>>()
  metadata?.setRunEventSink?.((event) => {
    const payloadProjectId = (event.payload as { projectId?: string } | null)?.projectId
    const runProjectId = payloadProjectId ?? metadata.getRun(event.runId)?.projectId
    const projectId = String(runProjectId ?? '')
    const listeners = runEventListeners.get(projectId)
    if (listeners === undefined) return
    for (const listener of listeners) {
      try { listener() } catch { /* 推送失败不影响 Run 生命周期 */ }
    }
  })
  const obsidian = options.obsidianConnector ?? new ObsidianReadOnlyConnector()
  const obsidianSessions = options.obsidianSessions ?? new ObsidianConnectorSessionStore()
  const connectorRegistry = options.connectorRegistry ?? new ResourceConnectorRegistry([obsidian])
  const ownsConversationService = options.conversationImportService === undefined && metadata !== undefined
  const conversations = options.conversationImportService ?? (metadata === undefined ? undefined : new ConversationImportService(metadata))
  const previewWorker = options.previewWorkerService
    ?? (metadata === undefined ? undefined : new PreviewWorkerService(metadata, {
      cacheService: new PreviewCacheService(metadata, {
        cacheRoot: options.previewCacheRoot ?? `${metadata.databasePath}.preview-cache`,
      }),
    }))
  let server: Server | undefined
  let currentAddress: LocalCoreAddress | undefined
  let lifecycleSignal: AbortSignal | undefined
  let lifecycleAbort: (() => void) | undefined

  const handleRequest = async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    const controller = new AbortController()
    let timedOut = false
    const timeout = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, requestTimeoutMs)
    const abort = () => controller.abort()
    request.once('aborted', abort)
    response.once('close', () => {
      if (!response.writableEnded) abort()
    })

    try {
      const url = new URL(request.url ?? '/', `http://${LOOPBACK_HOST}`)
      const method = request.method ?? 'GET'
      const pathname = url.pathname
      const routeHelpers = { sendJson, failure, readJsonBody, readRawBody, isRecord, isStringArray, withAbort, statusForError, sendBinary }

      const hostHeader = request.headers.host ?? ''
      const requestHost = hostHeader.replace(/^\[|\](:\d+)?$/g, '').split(':')[0]?.toLowerCase()
      if (requestHost !== '127.0.0.1' && requestHost !== 'localhost' && requestHost !== '::1') {
        sendJson(response, 403, failure('VALIDATION', 'Local Core Host must be loopback.'))
        return
      }
      const origin = request.headers.origin
      if (origin !== undefined && !allowedOrigins.has(origin)) {
        sendJson(response, 403, failure('VALIDATION', 'Origin is not allowed.'))
        return
      }

      // ---- Health ----
      if (method === 'GET' && pathname === '/health') {
        sendJson(response, 200, getHealthStatus())
        return
      }

      if (apiToken !== undefined && !validBearerToken(request.headers.authorization, apiToken)) {
        sendJson(response, 401, failure('VALIDATION', 'Local Core authorization is required.'))
        return
      }

      // ---- Project Catalog ----
      if (method === 'POST' && pathname === '/system/select-directory') {
        const body = await readJsonBody(request, controller.signal) as { title?: unknown }
        const title = typeof body.title === 'string' && body.title.trim()
          ? body.title.trim().slice(0, 120)
          : '选择项目目录'
        const result = await (options.directoryPicker ?? selectNativeDirectory)({ title })
        sendJson(response, 200, { ok: true, value: result })
        return
      }

      if (method === 'GET' && pathname === '/connectors') {
        sendJson(response, 200, { ok: true, value: connectorRegistry.capabilities() })
        return
      }

      if (method === 'POST' && pathname === '/connectors/obsidian/select-and-scan') {
        const selected = await (options.directoryPicker ?? selectNativeDirectory)({ title: '选择 Obsidian Vault' })
        if (selected.cancelled || selected.path === undefined) {
          sendJson(response, 200, { ok: true, value: null })
          return
        }
        try {
          const scanned = await obsidian.scan(selected.path)
          sendJson(response, 200, { ok: true, value: obsidianSessions.create(selected.path, scanned) })
        } catch (error: unknown) {
          sendJson(response, 400, failure('VALIDATION', error instanceof Error ? error.message : 'Obsidian Vault 扫描失败。'))
        }
        return
      }

      const obsidianImportMatch = /^\/projects\/([^/]+)\/connectors\/obsidian\/import$/.exec(pathname)
      if (method === 'POST' && obsidianImportMatch !== null) {
        if (!requireMetadata(metadata, response)) return
        if (resources === undefined) {
          sendJson(response, 503, failure('UNAVAILABLE', '通用资源导入服务暂不可用。'))
          return
        }
        const projectId = decodeURIComponent(obsidianImportMatch[1] ?? '')
        if (!requireProject(projectId, metadata, response)) return
        const input = await readJsonBody(request, controller.signal)
        if (!isRecord(input)
          || typeof input.scanId !== 'string'
          || !isStringArray(input.relativePaths)
          || input.relativePaths.length < 1 || input.relativePaths.length > 200
          || typeof input.scopeId !== 'string'
          || !isRecord(input.position) || typeof input.position.x !== 'number' || typeof input.position.y !== 'number'
          || Object.keys(input).some((key) => !['scanId', 'relativePaths', 'scopeId', 'position'].includes(key))) {
          sendJson(response, 400, failure('INVALID_ARGUMENT', '请选择 1–200 个 Obsidian Markdown 笔记。'))
          return
        }
        const stored = obsidianSessions.get(input.scanId)
        if (stored === undefined) {
          sendJson(response, 410, failure('NOT_FOUND', 'Obsidian 扫描已过期，请重新选择 Vault。'))
          return
        }
        const allowedPaths = new Set(stored.scan.notes.map((note) => note.relativePath))
        const relativePaths = [...new Set(input.relativePaths)]
        if (relativePaths.some((path) => !allowedPaths.has(path))) {
          sendJson(response, 400, failure('VALIDATION', '选中的笔记不属于本次 Obsidian 扫描。'))
          return
        }
        try {
          const imported = []
          for (let index = 0; index < relativePaths.length; index += 1) {
            const relativePath = relativePaths[index] as string
            const note = await obsidian.read(stored.rootPath, relativePath)
            const identity = `obsidian-${createHash('sha256').update(projectId).update('\0').update(stored.scan.vaultName).update('\0').update(relativePath).update('\0').update(note.contentHash).digest('hex').slice(0, 24)}`
            const outcome = await resources.importFile(projectId as ProjectId, {
              importRequestId: identity,
              fileName: relativePath.replace(/[\/]+/g, '--'),
              contentType: 'text/markdown',
              bytes: note.bytes,
              scopeId: input.scopeId,
              position: {
                x: input.position.x + (index % 4) * 250,
                y: input.position.y + Math.floor(index / 4) * 180,
              },
            })
            imported.push(publicResourceImportResult(outcome))
          }
          sendJson(response, 201, { ok: true, value: imported })
        } catch (error: unknown) {
          sendJson(response, 409, failure('CONFLICT', error instanceof Error ? error.message : 'Obsidian 笔记导入失败。'))
        }
        return
      }

      // ---- Executor Gateway (the only MCP-facing path to Light Bridge) ----
      if (method === 'GET' && pathname === '/executor/health') {
        const result = await bridgeProxy('/health', {}, controller.signal)
        sendJson(response, result.status, result.body); return
      }
      if (method === 'GET' && pathname === '/executor/capabilities') {
        const result = await bridgeProxy('/v1/capabilities', {}, controller.signal)
        sendJson(response, result.status, result.body); return
      }
      if (method === 'POST' && pathname === '/executor/tasks/claim-next') {
        const body = await readJsonBody(request, controller.signal)
        const result = await bridgeProxy('/v1/tasks/claim-next', { method: 'POST', body }, controller.signal)
        sendJson(response, result.status, result.body); return
      }
      const executorTaskMatch = /^\/executor\/tasks\/([^/]+)$/.exec(pathname)
      const executorTaskActionMatch = /^\/executor\/tasks\/([^/]+)\/(claim|running|heartbeat|result|cancel)$/.exec(pathname)
      const executorRunTaskMatch = /^\/executor\/runs\/([^/]+)\/task$/.exec(pathname)
      if (method === 'GET' && executorTaskMatch !== null) {
        const result = await bridgeProxy(`/v1/tasks/${encodeURIComponent(decodeURIComponent(executorTaskMatch[1] ?? ''))}`, {}, controller.signal)
        sendJson(response, result.status, result.body); return
      }
      if (method === 'GET' && executorRunTaskMatch !== null) {
        const result = await bridgeProxy(`/v1/tasks/by-run/${encodeURIComponent(decodeURIComponent(executorRunTaskMatch[1] ?? ''))}`, {}, controller.signal)
        sendJson(response, result.status, result.body); return
      }
      if (method === 'POST' && executorTaskActionMatch !== null) {
        const taskId = encodeURIComponent(decodeURIComponent(executorTaskActionMatch[1] ?? ''))
        const action = executorTaskActionMatch[2] ?? ''
        const body = await readJsonBody(request, controller.signal)
        const result = await bridgeProxy(`/v1/tasks/${taskId}/${action}`, { method: 'POST', body }, controller.signal)
        sendJson(response, result.status, result.body); return
      }

      if (await handleConversationsRoute({
        method,
        pathname,
        url,
        request,
        response,
        controller,
        metadata,
        conversations,
        helpers: routeHelpers,
      })) return
      if (await handleProjectsRoute({
        method,
        pathname,
        url,
        request,
        response,
        controller,
        metadata,
        catalog,
        allowedRoot: options.allowedRoot,
        maxDocumentPreviewBytes: MAX_DOCUMENT_PREVIEW_BYTES,
        createProjectIdFn: createProjectId,
        helpers: routeHelpers,
      })) return
      if (await handleCanvasRoute({
        method,
        pathname,
        url,
        request,
        response,
        controller,
        metadata,
        activeContext,
        contextProposals,
        runtimeApplication,
        runEventListeners,
        helpers: routeHelpers,
      })) return
      if (await handleContextProposalsRoute({
        method,
        pathname,
        url,
        request,
        response,
        controller,
        metadata,
        activeContext,
        contextProposals,
        helpers: routeHelpers,
      })) return
      if (await handleRunsRoute({
        method,
        pathname,
        url,
        request,
        response,
        controller,
        metadata,
        runtimeReview,
        runtimeApplication,
        contextManifest,
        helpers: routeHelpers,
      })) return
      if (await handleLcosprojRoute({
        method,
        pathname,
        url,
        request,
        response,
        controller,
        metadata,
        maxLcosprojBodyBytes: MAX_LCOSPROJ_BODY_BYTES,
        helpers: routeHelpers,
      })) return
      if (await handleArtifactsRoute({
        method,
        pathname,
        url,
        request,
        response,
        controller,
        metadata,

        helpers: routeHelpers,
      })) return
      if (await handleWorkspaceStatesRoute({
        method,
        pathname,
        url,
        request,
        response,
        controller,
        metadata,

        helpers: routeHelpers,
      })) return
      const runtimeProvidersMatch = /^\/runtime\/providers$/.exec(pathname)
      if (method === 'GET' && runtimeProvidersMatch !== null) {
        if (runtimeApplication === undefined) {
          sendJson(response, 503, failure('UNAVAILABLE', 'Runtime execution service is not configured.'))
          return
        }
        try {
          sendJson(response, 200, { ok: true, value: await runtimeApplication.providers() })
        } catch (error: unknown) {
          sendJson(response, 503, failure('UNAVAILABLE', error instanceof Error ? error.message : 'Provider status unavailable.'))
        }
        return
      }

      const codexDispatchPlanMatch = /^\/runtime\/codex-dispatch-plan$/.exec(pathname)
      if (method === 'POST' && codexDispatchPlanMatch !== null) {
        if (!requireMetadata(metadata, response)) return
        if (runtimeApplication === undefined) {
          sendJson(response, 503, failure('UNAVAILABLE', 'Runtime execution service is not configured.'))
          return
        }
        const input = await readJsonBody(request, controller.signal)
        if (!isRecord(input) || typeof input.projectId !== 'string'
          || (input.sessions !== undefined && !Array.isArray(input.sessions))
          || Object.keys(input).some((key) => !['projectId', 'sessions'].includes(key))) {
          sendJson(response, 400, failure('INVALID_ARGUMENT', 'Dispatch plan requires projectId and optional sessions array.'))
          return
        }
        const project = metadata.getProject(input.projectId)
        if (project === undefined) {
          sendJson(response, 404, failure('NOT_FOUND', 'Project not found.'))
          return
        }
        const suppliedSessions = (input.sessions as unknown[] | undefined ?? []).flatMap((item) => {
          if (!isRecord(item) || typeof item.sessionId !== 'string') return []
          return [{
            sessionId: item.sessionId,
            ...(item.guiActive === true ? { guiActive: true } : {}),
            ...(item.busy === true ? { busy: true } : {}),
          }]
        })
        const preferredBinding = metadata.getProviderSessionBinding(input.projectId, 'codex')
        const suppliedById = new Map(suppliedSessions.map((session) => [session.sessionId, session]))
        const preferredSession = preferredBinding?.status === 'active'
          ? { sessionId: preferredBinding.externalSessionId, ...(suppliedById.get(preferredBinding.externalSessionId) ?? {}) }
          : undefined
        const sessions = [
          ...(preferredSession === undefined ? [] : [preferredSession]),
          ...suppliedSessions.filter((session) => session.sessionId !== preferredSession?.sessionId),
        ]
        const reviews = runtimeApplication.getProjectReviews(input.projectId as ProjectId, 100)
        const taskStates = new Map<string, { readonly status?: string; readonly leaseExpiresAt?: string }>()
        for (const review of reviews) {
          if (review.run.provider !== 'codex') continue
          try {
            const state = await runtimeApplication.getCodexTaskState(review.run.id)
            if (state !== undefined) taskStates.set(String(review.run.id), state)
          } catch {
            // 拿不到 Bridge 状态就不派这一条，避免盲派
          }
        }
        sendJson(response, 200, {
          ok: true,
          value: planCodexDispatch(
            reviews,
            project.rootPath,
            sessions,
            taskStates,
          ),
        })
        return
      }

      const finalizeRunMatch = /^\/runs\/([^/]+)\/finalize$/.exec(pathname)
      if (method === 'POST' && finalizeRunMatch !== null) {
        if (runtimeApplication === undefined) {
          sendJson(response, 503, failure('UNAVAILABLE', 'Runtime execution service is not configured.'))
          return
        }
        const runId = decodeURIComponent(finalizeRunMatch[1] ?? '') as RunId
        try {
          const input = await readJsonBody(request, controller.signal)
          if (!isRecord(input)
            || !['completed', 'retrying'].includes(String(input.decision))
            || (input.comment !== undefined && typeof input.comment !== 'string')
            || Object.keys(input).some((key) => !['decision', 'comment'].includes(key))) {
            sendJson(response, 400, failure('INVALID_ARGUMENT', 'Finalize requires completed or retrying decision.'))
            return
          }
          sendJson(response, 200, {
            ok: true,
            value: await runtimeApplication.finalize(
              runId,
              input.decision as 'completed' | 'retrying',
              typeof input.comment === 'string' ? input.comment : undefined,
            ),
          })
        } catch (error: unknown) {
          sendJson(response, 409, failure('CONFLICT', error instanceof Error ? error.message : 'Runtime finalize conflicted.'))
        }
        return
      }

      if (runtimeReview !== undefined) {
        if (await handleRuntimeReviewRoute({
          pathname,
          request,
          response,
          controller,
          runtimeReview,
          maxBodyBytes: MAX_BODY_BYTES,
          sendJson,
          failure,
          readJsonBody,
          readRawBody,
          isRecord,
        })) return
      } else if (method === 'POST' && /^\/artifact-returns\/([^/]+)\/(accept|reject|retry)$/.test(pathname)) {
        sendJson(response, 503, failure('UNAVAILABLE', 'Runtime Review service is not configured.'))
        return
      }

      // Browser supplies only an opaque trusted selection ID, never a path.
      const sourceMatch = /^\/projects\/([^/]+)\/sources$/.exec(pathname)
      if (method === 'POST' && sourceMatch !== null) {
        if (!requireMetadata(metadata, response)) return
        if (fileRegistry === undefined) {
          sendJson(response, 503, failure('UNAVAILABLE', 'Trusted file picker adapter is not configured.'))
          return
        }
        let input: unknown
        try { input = await readJsonBody(request, controller.signal) } catch {
          sendJson(response, 400, failure('INVALID_ARGUMENT', 'Source registration body must be valid JSON.'))
          return
        }
        if (!isRecord(input) || typeof input.selectionId !== 'string'
          || ('path' in input) || ('absolutePath' in input) || ('rootPath' in input)
          || (input.title !== undefined && typeof input.title !== 'string')) {
          sendJson(response, 400, failure('INVALID_ARGUMENT', 'Source registration requires only selectionId and optional title.'))
          return
        }
        const projectId = decodeURIComponent(sourceMatch[1] ?? '')
        try {
          const result = await fileRegistry.registerSource(
            projectId as Project['id'],
            input as unknown as RegisterTrustedSourceInput,
            controller.signal,
          )
          sendJson(response, 201, { ok: true, value: result })
        } catch (error: unknown) {
          sendJson(response, 400, failure('VALIDATION', error instanceof Error ? error.message : 'Source registration failed.'))
        }
        return
      }

      const importMatch = /^\/projects\/([^/]+)\/imports$/.exec(pathname)
      if (method === 'POST' && importMatch !== null) {
        if (!requireMetadata(metadata, response)) return
        if (importCopy === undefined) {
          sendJson(response, 503, failure('UNAVAILABLE', 'Import Copy service is not configured.'))
          return
        }
        try {
          const body = await readRawBody(request, controller.signal, MAX_IMPORT_BODY_BYTES)
          const multipart = parseMultipartImport(request.headers['content-type'], body)
          const projectId = decodeURIComponent(importMatch[1] ?? '')
          const x = Number(multipart.fields['position.x'])
          const y = Number(multipart.fields['position.y'])
          const forbiddenPathField = Object.keys(multipart.fields).find((field) => FORBIDDEN_BROWSER_PATH_FIELDS.has(field))
          if (forbiddenPathField !== undefined) {
            sendJson(response, 400, failure('INVALID_ARGUMENT', `Import Copy does not accept browser supplied path field: ${forbiddenPathField}.`))
            return
          }
          if (!multipart.fields.importRequestId || !multipart.fields.scopeId || !Number.isFinite(x) || !Number.isFinite(y)) {
            sendJson(response, 400, failure('INVALID_ARGUMENT', 'Import Copy requires importRequestId, scopeId, position.x, position.y and file.'))
            return
          }
          const result = await importCopy.importCopy(projectId as ProjectId, {
            importRequestId: multipart.fields.importRequestId,
            scopeId: multipart.fields.scopeId,
            position: { x, y },
            fileName: multipart.file.fileName,
            contentType: multipart.file.contentType,
            bytes: multipart.file.bytes,
          })
          const outcome = resources === undefined
            ? undefined
            : await resources.afterImport(projectId as ProjectId, result)
          sendJson(response, result.reused ? 200 : 201, {
            ok: true,
            value: {
              artifact: result.artifact,
              revision: result.revision,
              view: result.view,
              reused: result.reused,
              ...(outcome === undefined ? {} : { resource: publicResourceImportResult(outcome) }),
            },
          })
        } catch (error: unknown) {
          const status = error instanceof RangeError ? 413 : error instanceof ImportCopyConflictError ? 409 : 400
          sendJson(response, status, failure(error instanceof ImportCopyConflictError ? 'CONFLICT' : 'VALIDATION', error instanceof Error ? error.message : 'Import Copy failed.'))
        }
        return
      }

      // ---- Universal Resource Import (U1): URL + descriptor read/reanalyze ----
      const resourceUrlImportMatch = /^\/projects\/([^/]+)\/resources\/import-url$/.exec(pathname)
      const uploadSessionCreateMatch = /^\/projects\/([^/]+)\/resource-upload-sessions$/.exec(pathname)
      const uploadSessionFileMatch = /^\/projects\/([^/]+)\/resource-upload-sessions\/([^/]+)\/files$/.exec(pathname)
      const uploadSessionCompleteMatch = /^\/projects\/([^/]+)\/resource-upload-sessions\/([^/]+)\/complete$/.exec(pathname)
      if (method === 'POST' && uploadSessionCreateMatch !== null) {
        if (uploads === undefined || !requireMetadata(metadata, response)) return
        try {
          const projectId = decodeURIComponent(uploadSessionCreateMatch[1] ?? '')
          const body = await readJsonBody(request, controller.signal) as Record<string, unknown>
          if (typeof body.importRequestId !== 'string' || typeof body.rootName !== 'string' || typeof body.scopeId !== 'string'
            || typeof body.x !== 'number' || typeof body.y !== 'number') throw new Error('Upload session metadata is invalid.')
          sendJson(response, 201, { ok: true, value: await uploads.start({ projectId, importRequestId: body.importRequestId, rootName: body.rootName, scopeId: body.scopeId, x: body.x, y: body.y, ...(typeof body.note === 'string' ? { note: body.note } : {}) }) })
        } catch (error) { sendJson(response, 400, failure('VALIDATION', error instanceof Error ? error.message : 'Upload session failed.')) }
        return
      }
      if (method === 'PUT' && uploadSessionFileMatch !== null) {
        if (uploads === undefined || !requireMetadata(metadata, response)) return
        try {
          const relativePath = url.searchParams.get('path')
          if (relativePath === null) throw new Error('Relative path is required.')
          await uploads.putFile(decodeURIComponent(uploadSessionFileMatch[1] ?? ''), decodeURIComponent(uploadSessionFileMatch[2] ?? ''), relativePath, request)
          sendJson(response, 200, { ok: true, value: null })
        } catch (error) { sendJson(response, error instanceof RangeError ? 413 : 400, failure('VALIDATION', error instanceof Error ? error.message : 'Upload failed.')) }
        return
      }
      if (method === 'POST' && uploadSessionCompleteMatch !== null) {
        if (uploads === undefined || !requireMetadata(metadata, response)) return
        try {
          const outcome = await uploads.complete(decodeURIComponent(uploadSessionCompleteMatch[1] ?? ''), decodeURIComponent(uploadSessionCompleteMatch[2] ?? ''))
          sendJson(response, outcome.reused ? 200 : 201, { ok: true, value: publicResourceImportResult(outcome) })
        } catch (error) { sendJson(response, error instanceof ResourcePackageConflictError ? 409 : error instanceof RangeError ? 413 : 400, failure('VALIDATION', error instanceof Error ? error.message : 'Upload completion failed.')) }
        return
      }
      const resourceDirectoryImportMatch = /^\/projects\/([^/]+)\/resources\/import-directory$/.exec(pathname)
      const resourceArchiveImportMatch = /^\/projects\/([^/]+)\/resources\/import-archive$/.exec(pathname)
      if (method === 'POST' && resourceDirectoryImportMatch !== null) {
        sendJson(response, 410, failure('VALIDATION', 'Base64 directory import was removed; use resource-upload-sessions.'))
        return
      }
      if (method === 'POST' && resourceArchiveImportMatch !== null) {
        if (!requireMetadata(metadata, response)) return
        if (packages === undefined || importCopy === undefined) {
          sendJson(response, 503, failure('UNAVAILABLE', 'Resource Package service is not configured.'))
          return
        }
        try {
          const raw = await readRawBody(request, controller.signal, MAX_IMPORT_BODY_BYTES)
          const multipart = parseMultipartImport(request.headers['content-type'], raw)
          const projectId = decodeURIComponent(resourceArchiveImportMatch[1] ?? '')
          const x = Number(multipart.fields['position.x'])
          const y = Number(multipart.fields['position.y'])
          if (!multipart.fields.importRequestId || !multipart.fields.scopeId || !Number.isFinite(x) || !Number.isFinite(y)) {
            sendJson(response, 400, failure('INVALID_ARGUMENT', 'Archive import requires importRequestId, scopeId, position and file.'))
            return
          }
          const outcome = await packages.importArchive(projectId as ProjectId, {
            importRequestId: multipart.fields.importRequestId,
            fileName: multipart.file.fileName,
            bytes: multipart.file.bytes,
            scopeId: multipart.fields.scopeId,
            position: { x, y },
            ...(multipart.fields.note === undefined ? {} : { userNote: multipart.fields.note }),
          })
          sendJson(response, outcome.reused ? 200 : 201, { ok: true, value: publicResourceImportResult(outcome) })
        } catch (error: unknown) {
          const status = error instanceof RangeError ? 413 : error instanceof ResourcePackageConflictError ? 409 : 400
          sendJson(response, status, failure(error instanceof ResourcePackageConflictError ? 'CONFLICT' : 'VALIDATION', error instanceof Error ? error.message : 'Archive import failed.'))
        }
        return
      }
      if (method === 'POST' && resourceUrlImportMatch !== null) {
        if (!requireMetadata(metadata, response)) return
        if (resources === undefined) {
          sendJson(response, 503, failure('UNAVAILABLE', 'Universal Resource Import service is not configured.'))
          return
        }
        let input: unknown
        try { input = await readJsonBody(request, controller.signal) } catch {
          sendJson(response, 400, failure('INVALID_ARGUMENT', 'Import URL body must be valid JSON.'))
          return
        }
        const body = input as {
          url?: unknown
          title?: unknown
          note?: unknown
          importRequestId?: unknown
          scopeId?: unknown
          x?: unknown
          y?: unknown
        }
        if (typeof body?.url !== 'string' || body.url.trim() === '' || body.url.length > 2048) {
          sendJson(response, 400, failure('INVALID_ARGUMENT', 'url must be a non-empty string under 2048 characters.'))
          return
        }
        if (body.title !== undefined && typeof body.title !== 'string') {
          sendJson(response, 400, failure('INVALID_ARGUMENT', 'title must be a string when provided.'))
          return
        }
        if (body.note !== undefined && typeof body.note !== 'string') {
          sendJson(response, 400, failure('INVALID_ARGUMENT', 'note must be a string when provided.'))
          return
        }
        const projectId = decodeURIComponent(resourceUrlImportMatch[1] ?? '')
        const project = metadata.getProject(projectId)
        if (project === undefined) {
          sendJson(response, 404, failure('NOT_FOUND', 'Project not found.'))
          return
        }
        const graph = metadata.get(projectId)
        const rootScope = graph?.scopes.find((scope) => scope.kind === 'root') ?? graph?.scopes[0]
        const scopeId = typeof body.scopeId === 'string' && body.scopeId.trim() !== ''
          ? body.scopeId
          : String(rootScope?.id ?? '')
        const x = typeof body.x === 'number' && Number.isFinite(body.x) ? body.x : 180
        const y = typeof body.y === 'number' && Number.isFinite(body.y) ? body.y : 160
        try {
          const outcome = await resources.importUrl(projectId as ProjectId, {
            importRequestId: typeof body.importRequestId === 'string' && body.importRequestId.trim() !== ''
              ? body.importRequestId
              : `url-${createProjectId(body.url).slice('project-'.length)}`,
            url: body.url,
            ...(body.title === undefined ? {} : { title: body.title }),
            ...(body.note === undefined ? {} : { userNote: body.note }),
            scopeId,
            position: { x, y },
          })
          sendJson(response, outcome.reused === undefined || !outcome.reused ? 201 : 200, { ok: true, value: publicResourceImportResult(outcome) })
        } catch (error: unknown) {
          const status = error instanceof ImportCopyConflictError ? 409 : 400
          sendJson(response, status, failure(error instanceof ImportCopyConflictError ? 'CONFLICT' : 'VALIDATION', error instanceof Error ? error.message : 'URL import failed.'))
        }
        return
      }

      const resourceDescriptorMatch = /^\/projects\/([^/]+)\/resources\/([^/]+)\/descriptor$/.exec(pathname)
      const resourceReanalyzeMatch = /^\/projects\/([^/]+)\/resources\/([^/]+)\/reanalyze$/.exec(pathname)
      const resourceContentMatch = /^\/projects\/([^/]+)\/resources\/([^/]+)\/content$/.exec(pathname)
      const resourceListMatch = /^\/projects\/([^/]+)\/resources$/.exec(pathname)
      const resourceOneMatch = /^\/projects\/([^/]+)\/resources\/([^/]+)$/.exec(pathname)
      const resourceMatchRoute = /^\/projects\/([^/]+)\/resources\/match$/.exec(pathname)
      if (method === 'POST' && resourceMatchRoute !== null) {
        if (!requireMetadata(metadata, response)) return
        if (resources === undefined) {
          sendJson(response, 503, failure('UNAVAILABLE', 'Universal Resource Import service is not configured.'))
          return
        }
        let input: unknown
        try { input = await readJsonBody(request, controller.signal) } catch {
          sendJson(response, 400, failure('INVALID_ARGUMENT', 'Match body must be valid JSON.'))
          return
        }
        const body = input as {
          instruction?: unknown
          outputIntent?: unknown
          mediaTypes?: unknown
          limit?: unknown
        }
        if (typeof body?.instruction !== 'string' || body.instruction.trim() === '') {
          sendJson(response, 400, failure('INVALID_ARGUMENT', 'instruction is required.'))
          return
        }
        if (body.outputIntent !== undefined && body.outputIntent !== 'create' && body.outputIntent !== 'revise' && body.outputIntent !== 'analyze') {
          sendJson(response, 400, failure('INVALID_ARGUMENT', 'outputIntent must be create, revise or analyze.'))
          return
        }
        if (body.mediaTypes !== undefined && (!Array.isArray(body.mediaTypes) || body.mediaTypes.some((item) => typeof item !== 'string'))) {
          sendJson(response, 400, failure('INVALID_ARGUMENT', 'mediaTypes must be an array of strings.'))
          return
        }
        const projectId = decodeURIComponent(resourceMatchRoute[1] ?? '')
        const graph = metadata.get(projectId)
        const active = graph === undefined ? undefined : activeContext.get(projectId, graph)
        const viewToArtifact = new Map((graph?.artifactViews ?? []).map((view) => [String(view.id), String(view.artifactId)]))
        const descriptors = resources.list(projectId)
        const artifactToResource = new Map(descriptors.map((descriptor) => [descriptor.artifactId, descriptor.resourceId]))
        const mapViews = (viewIds: readonly string[] | undefined): string[] => (viewIds ?? [])
          .map((viewId) => viewToArtifact.get(String(viewId)))
          .filter((artifactId): artifactId is string => artifactId !== undefined)
        const excludedResourceIds = mapViews(active?.excludedContextIds)
          .map((artifactId) => artifactToResource.get(artifactId))
          .filter((resourceId): resourceId is string => resourceId !== undefined)
        const pinnedResourceIds = mapViews(active?.pinnedContextIds)
          .map((artifactId) => artifactToResource.get(artifactId))
          .filter((resourceId): resourceId is string => resourceId !== undefined)
        const activeContextArtifactIds = mapViews(active?.selectedViewIds)
        const matches = matcher.match(descriptors, {
          projectId,
          instruction: body.instruction,
          ...(body.outputIntent === undefined ? {} : { outputIntent: body.outputIntent as 'create' | 'revise' | 'analyze' }),
          ...(body.mediaTypes === undefined ? {} : { mediaTypes: body.mediaTypes as readonly string[] }),
          ...(body.limit === undefined ? {} : { limit: Number(body.limit) }),
        }, {
          ...(excludedResourceIds.length === 0 ? {} : { excludedResourceIds }),
          ...(pinnedResourceIds.length === 0 ? {} : { pinnedResourceIds }),
          ...(activeContextArtifactIds.length === 0 ? {} : { activeContextArtifactIds }),
        })
        sendJson(response, 200, { ok: true, value: matches })
        return
      }
      if (resources !== undefined) {
        if (method === 'GET' && resourceListMatch !== null) {
          if (!requireMetadata(metadata, response)) return
          const projectId = decodeURIComponent(resourceListMatch[1] ?? '')
          const descriptors = resources.list(projectId)
          sendJson(response, 200, {
            ok: true,
            value: descriptors.map((descriptor) => ({
              resourceId: descriptor.resourceId,
              artifactId: descriptor.artifactId,
              title: descriptor.display.title,
              status: descriptor.understanding.status,
              analyzerVersion: descriptor.understanding.analyzerVersion,
            })),
          })
          return
        }
        if (method === 'GET' && resourceDescriptorMatch !== null) {
          if (!requireMetadata(metadata, response)) return
          const projectId = decodeURIComponent(resourceDescriptorMatch[1] ?? '')
          const resourceId = decodeURIComponent(resourceDescriptorMatch[2] ?? '')
          const descriptor = resources.getDescriptor(projectId, resourceId)
          if (descriptor === undefined) {
            sendJson(response, 404, failure('NOT_FOUND', 'Resource descriptor not found.'))
            return
          }
          sendJson(response, 200, { ok: true, value: descriptor })
          return
        }
        if (method === 'GET' && resourceContentMatch !== null) {
          if (!requireMetadata(metadata, response)) return
          if (resourceReader === undefined) {
            sendJson(response, 503, failure('UNAVAILABLE', 'Resource Reader is not configured.'))
            return
          }
          const projectId = decodeURIComponent(resourceContentMatch[1] ?? '')
          const resourceId = decodeURIComponent(resourceContentMatch[2] ?? '')
          const params = url.searchParams
          const format = params.get('format') ?? 'text'
          if (format !== 'raw' && format !== 'text' && format !== 'json_tree') {
            sendJson(response, 400, failure('INVALID_ARGUMENT', 'format must be raw, text or json_tree.'))
            return
          }
          const offset = params.get('offset') === null ? undefined : Number(params.get('offset'))
          const limit = params.get('limit') === null ? undefined : Number(params.get('limit'))
          if ((offset !== undefined && !Number.isFinite(offset)) || (limit !== undefined && !Number.isFinite(limit))) {
            sendJson(response, 400, failure('INVALID_ARGUMENT', 'offset and limit must be numbers.'))
            return
          }
          try {
            const result = await resourceReader.read(projectId, resourceId, {
              ...(params.get('path') === null ? {} : { path: String(params.get('path')) }),
              ...(offset === undefined ? {} : { offset }),
              ...(limit === undefined ? {} : { limit }),
              format: format as 'raw' | 'text' | 'json_tree',
            })
            sendJson(response, 200, { ok: true, value: result })
          } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Resource content read failed.'
            sendJson(response, message.includes('not found') ? 404 : 400, failure(message.includes('not found') ? 'NOT_FOUND' : 'VALIDATION', message))
          }
          return
        }
        if (method === 'POST' && resourceReanalyzeMatch !== null) {
          if (!requireMetadata(metadata, response)) return
          const projectId = decodeURIComponent(resourceReanalyzeMatch[1] ?? '')
          const resourceId = decodeURIComponent(resourceReanalyzeMatch[2] ?? '')
          const descriptor = await resources.reanalyze(projectId, resourceId)
          if (descriptor === undefined) {
            sendJson(response, 404, failure('NOT_FOUND', 'Resource descriptor not found.'))
            return
          }
          sendJson(response, 200, { ok: true, value: descriptor })
          return
        }
        if (method === 'GET' && resourceOneMatch !== null) {
          if (!requireMetadata(metadata, response)) return
          const projectId = decodeURIComponent(resourceOneMatch[1] ?? '')
          const resourceId = decodeURIComponent(resourceOneMatch[2] ?? '')
          const descriptor = resources.getDescriptor(projectId, resourceId)
          if (descriptor === undefined) {
            sendJson(response, 404, failure('NOT_FOUND', 'Resource not found.'))
            return
          }
          const artifact = metadata.getArtifact(descriptor.artifactId)
          sendJson(response, 200, { ok: true, value: { resourceId, artifact: artifact ?? null, descriptor } })
          return
        }
      }

      // ==================== Individual CRUD routes ====================

      const entityResult = await handleEntityRoute(method, pathname, metadata, fileObservation, previewWorker, request, controller.signal)
      if (entityResult !== undefined) {
        sendJson(response, entityResult.status, entityResult.body)
        return
      }

      // Fallback
      sendJson(response, 404, failure('INVALID_ARGUMENT', 'Route not found.'))
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError' && !response.headersSent && !response.destroyed) {
        sendJson(response, timedOut ? 408 : 499, failure('ABORTED', timedOut ? 'Request timed out.' : 'Request was aborted.'))
      } else if (!response.headersSent && !response.destroyed) {
        sendJson(response, 500, failure('INTERNAL', 'Unexpected Local Core error.'))
      } else response.destroy()
    } finally {
      clearTimeout(timeout)
      request.removeListener('aborted', abort)
    }
  }

  const api: LocalCoreServer = {
    async start(signal?: AbortSignal): Promise<LocalCoreAddress> {
      if (signal?.aborted) throw new DOMException('Start aborted', 'AbortError')
      if (server !== undefined) throw new Error('Local Core server is already started.')

      const nextServer = createServer((request, response) => {
        void handleRequest(request, response)
      })
      server = nextServer

      let rejectStart: ((reason?: unknown) => void) | undefined
      const onAbort = () => { nextServer.close(); rejectStart?.(new DOMException('Start aborted', 'AbortError')) }
      signal?.addEventListener('abort', onAbort, { once: true })
      try {
        await new Promise<void>((resolvePromise, reject) => {
          rejectStart = reject
          nextServer.once('error', reject)
          nextServer.listen(options.port ?? 0, host, () => { nextServer.off('error', reject); resolvePromise() })
        })
      } catch (error: unknown) {
        server = undefined
        throw error
      } finally {
        rejectStart = undefined
        signal?.removeEventListener('abort', onAbort)
      }

      const bound = nextServer.address()
      if (bound === null || typeof bound === 'string') {
        await new Promise<void>((r) => nextServer.close(() => r()))
        server = undefined
        throw new Error('Local Core did not receive a TCP address.')
      }
      currentAddress = { host: LOOPBACK_HOST, port: bound.port }
      if (signal !== undefined) {
        if (signal.aborted) { await api.close(); throw new DOMException('Start aborted', 'AbortError') }
        lifecycleSignal = signal
        lifecycleAbort = () => { void api.close() }
        signal.addEventListener('abort', lifecycleAbort, { once: true })
        if (signal.aborted) { await api.close(); throw new DOMException('Start aborted', 'AbortError') }
      }
      return currentAddress
    },

    async close(): Promise<void> {
      const activeServer = server
      if (activeServer === undefined) return
      if (lifecycleSignal !== undefined && lifecycleAbort !== undefined) {
        lifecycleSignal.removeEventListener('abort', lifecycleAbort)
      }
      lifecycleSignal = undefined
      lifecycleAbort = undefined
      await new Promise<void>((resolvePromise, reject) => {
        activeServer.close((error) => { if (error) reject(error); else resolvePromise() })
        activeServer.closeAllConnections()
      })
      server = undefined
      currentAddress = undefined
      if (ownsConversationService) conversations?.close()
    },

    address(): LocalCoreAddress | undefined { return currentAddress },
  }

  return api
}

// ==================== Entity route handler ====================

type RouteResult = { status: number; body: unknown } | undefined

function validBearerToken(header: string | undefined, expected: string): boolean {
  if (header === undefined || !header.startsWith('Bearer ')) return false
  const actual = Buffer.from(header.slice('Bearer '.length), 'utf8')
  const expectedBytes = Buffer.from(expected, 'utf8')
  return actual.length === expectedBytes.length && timingSafeEqual(actual, expectedBytes)
}

function belongsToProject(value: unknown, projectId: string): value is Record<string, unknown> {
  return isRecord(value) && value.projectId === projectId && !containsForbiddenPathKey(value)
}

function relationEntityBelongsToProject(
  metadata: SqliteMetadataRepository,
  projectId: string,
  entityType: unknown,
  entityId: unknown,
): boolean {
  if (typeof entityId !== 'string' || entityId.trim() === '') return false
  if (entityType === 'artifact') return String(metadata.getArtifact(entityId)?.projectId ?? '') === projectId
  if (entityType === 'note') return String(metadata.getNote(entityId)?.projectId ?? '') === projectId
  if (entityType === 'scope') return metadata.get(projectId)?.scopes.some((scope) => String(scope.id) === entityId) ?? false
  return false
}

function isSafeRelationInput(metadata: SqliteMetadataRepository, projectId: string, value: unknown, relationId: string): value is Relation {
  if (!belongsToProject(value, projectId) || value.id !== relationId) return false
  if (typeof value.kind !== 'string' || value.kind.trim() === '' || value.kind.length > 80) return false
  if (typeof value.createdAt !== 'string' || typeof value.updatedAt !== 'string') return false
  return relationEntityBelongsToProject(metadata, projectId, value.sourceEntityType, value.sourceEntityId)
    && relationEntityBelongsToProject(metadata, projectId, value.targetEntityType, value.targetEntityId)
}

function containsForbiddenPathKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsForbiddenPathKey)
  if (!isRecord(value)) return false
  return Object.entries(value).some(([key, child]) => FORBIDDEN_BROWSER_PATH_FIELDS.has(key) || containsForbiddenPathKey(child))
}

async function handleEntityRoute(
  method: string,
  pathname: string,
  metadata: SqliteMetadataRepository | undefined,
  fileObservation: FileObservationService | undefined,
  previewWorker: PreviewWorkerService | undefined,
  request: IncomingMessage,
  signal: AbortSignal,
): Promise<RouteResult> {
  // All entity routes require metadata
  if (metadata === undefined) return undefined
  // --- Project ---
  const projectMatch = /^\/projects\/([^/]+)$/.exec(pathname)
  if (projectMatch !== null) {
    const projectId = decodeURIComponent(projectMatch[1] ?? '')
    if (method === 'GET') {
      const project = metadata.getProject(projectId)
      return project === undefined ? { status: 404, body: failure('NOT_FOUND', 'Project not found.') } : { status: 200, body: { ok: true, value: project } }
    }
    return undefined
  }

  // --- Workspaces ---
  const wsListMatch = /^\/projects\/([^/]+)\/workspaces$/.exec(pathname)
  const wsOneMatch = /^\/projects\/([^/]+)\/workspaces\/([^/]+)$/.exec(pathname)
  if (wsListMatch !== null) {
    const projectId = decodeURIComponent(wsListMatch[1] ?? '')
    if (method === 'GET') {
      return { status: 200, body: { ok: true, value: metadata.getWorkspaces(projectId) } }
    }
    if (method === 'POST') {
      const body = await readJsonBody(request, signal)
      if (!belongsToProject(body, projectId) || typeof body.id !== 'string') return { status: 400, body: failure('INVALID_ARGUMENT', 'Workspace identity must match the route project.') }
      const ws = body as unknown as Workspace
      metadata.upsertWorkspace(ws)
      return { status: 200, body: { ok: true, value: ws } }
    }
    return undefined
  }
  if (wsOneMatch !== null) {
    const projectId = decodeURIComponent(wsOneMatch[1] ?? '')
    const wsId = decodeURIComponent(wsOneMatch[2] ?? '')
    if (method === 'GET') {
      const ws = metadata.getWorkspace(wsId)
      return ws === undefined ? { status: 404, body: failure('NOT_FOUND', 'Workspace not found.') } : { status: 200, body: { ok: true, value: ws } }
    }
    if (method === 'PUT') {
      const body = await readJsonBody(request, signal)
      if (!belongsToProject(body, projectId) || body.id !== wsId) return { status: 400, body: failure('INVALID_ARGUMENT', 'Workspace identity must match the route.') }
      metadata.upsertWorkspace(body as unknown as Workspace)
      return { status: 200, body: { ok: true, value: body } }
    }
    return undefined
  }

  // --- Artifacts ---
  const artListMatch = /^\/projects\/([^/]+)\/artifacts$/.exec(pathname)
  const artOneMatch = /^\/projects\/([^/]+)\/artifacts\/([^/]+)$/.exec(pathname)
  if (artListMatch !== null && method === 'GET') {
    const projectId = decodeURIComponent(artListMatch[1] ?? '')
    return { status: 200, body: { ok: true, value: metadata.getArtifacts(projectId) } }
  }
  if (artOneMatch !== null) {
    const projectId = decodeURIComponent(artOneMatch[1] ?? '')
    const artId = decodeURIComponent(artOneMatch[2] ?? '')
    if (method === 'GET') {
      const art = metadata.getArtifact(artId)
      return art === undefined ? { status: 404, body: failure('NOT_FOUND', 'Artifact not found.') } : { status: 200, body: { ok: true, value: art } }
    }
    if (method === 'PUT') {
      const body = await readJsonBody(request, signal)
      if (!belongsToProject(body, projectId) || body.id !== artId) return { status: 400, body: failure('INVALID_ARGUMENT', 'Artifact identity must match the route.') }
      metadata.upsertArtifact(body as unknown as Artifact)
      return { status: 200, body: { ok: true, value: body } }
    }
    return undefined
  }

  // --- FileRecords (read-only by ID; refresh accepts only opaque FileRecord IDs; paths are never accepted from Browser) ---
  const fileListMatch = /^\/projects\/([^/]+)\/file-records$/.exec(pathname)
  const fileOneMatch = /^\/file-records\/([^/]+)$/.exec(pathname)
  const fileRefreshMatch = /^\/file-records\/([^/]+)\/refresh$/.exec(pathname)
  const fileAdoptMatch = /^\/file-records\/([^/]+)\/adopt$/.exec(pathname)
  if (fileListMatch !== null && method === 'GET') {
    const projectId = decodeURIComponent(fileListMatch[1] ?? '')
    return { status: 200, body: { ok: true, value: metadata.getFileRecords(projectId) } }
  }
  if (fileOneMatch !== null && method === 'GET') {
    const fileRecordId = decodeURIComponent(fileOneMatch[1] ?? '')
    const fileRecord = metadata.getFileRecord(fileRecordId)
    return fileRecord === undefined
      ? { status: 404, body: failure('NOT_FOUND', 'FileRecord not found.') }
      : { status: 200, body: { ok: true, value: fileRecord } }
  }
  if (fileRefreshMatch !== null && method === 'POST') {
    if (fileObservation === undefined) return { status: 503, body: failure('UNAVAILABLE', 'File Observation Service is not configured.') }
    const fileRecordId = decodeURIComponent(fileRefreshMatch[1] ?? '') as FileRecordId
    try {
      const result = await fileObservation.refresh(fileRecordId, signal)
      return { status: 200, body: { ok: true, value: result } }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'File observation failed.'
      return { status: message === 'FileRecord not found.' ? 404 : 400, body: failure(message === 'FileRecord not found.' ? 'NOT_FOUND' : 'VALIDATION', message) }
    }
  }
  if (fileAdoptMatch !== null && method === 'POST') {
    if (fileObservation === undefined) return { status: 503, body: failure('UNAVAILABLE', 'File Observation Service is not configured.') }
    const fileRecordId = decodeURIComponent(fileAdoptMatch[1] ?? '') as FileRecordId
    try {
      const result = await fileObservation.adopt(fileRecordId, signal)
      return { status: 201, body: { ok: true, value: result } }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'External change adoption failed.'
      const notFound = message === 'FileRecord not found.' || message === 'Current Artifact Revision not found.'
      return { status: notFound ? 404 : 409, body: failure(notFound ? 'NOT_FOUND' : 'CONFLICT', message) }
    }
  }

  // --- ArtifactViews ---
  const avListMatch = /^\/projects\/([^/]+)\/artifact-views$/.exec(pathname)
  const avOneMatch = /^\/projects\/([^/]+)\/artifact-views\/([^/]+)$/.exec(pathname)
  if (avListMatch !== null && method === 'GET') {
    const projectId = decodeURIComponent(avListMatch[1] ?? '')
    return { status: 200, body: { ok: true, value: metadata.getArtifactViewsByProject(projectId) } }
  }
  if (avOneMatch !== null) {
    const projectId = decodeURIComponent(avOneMatch[1] ?? '')
    const viewId = decodeURIComponent(avOneMatch[2] ?? '')
    if (method === 'GET') {
      const view = metadata.getArtifactView(viewId)
      const artifact = view === undefined ? undefined : metadata.getArtifact(String(view.artifactId))
      return view === undefined || artifact === undefined || String(artifact.projectId) !== projectId
        ? { status: 404, body: failure('NOT_FOUND', 'ArtifactView not found.') }
        : { status: 200, body: { ok: true, value: view } }
    }
    if (method === 'PUT') {
      const body = await readJsonBody(request, signal)
      if (!isRecord(body) || body.id !== viewId || typeof body.artifactId !== 'string' || containsForbiddenPathKey(body)) return { status: 400, body: failure('INVALID_ARGUMENT', 'ArtifactView identity must match the route.') }
      const artifact = metadata.getArtifact(body.artifactId)
      if (artifact === undefined || String(artifact.projectId) !== projectId) return { status: 400, body: failure('INVALID_ARGUMENT', 'ArtifactView Artifact must belong to the route project.') }
      const view = body as unknown as ArtifactView
      metadata.upsertArtifactView(view)
      return { status: 200, body: { ok: true, value: view } }
    }
    if (method === 'DELETE') {
      const existing = metadata.getArtifactView(viewId)
      const artifact = existing === undefined ? undefined : metadata.getArtifact(String(existing.artifactId))
      if (existing === undefined || artifact === undefined || String(artifact.projectId) !== projectId) return { status: 404, body: failure('NOT_FOUND', 'ArtifactView not found.') }
      metadata.deleteArtifactView(viewId)
      return { status: 200, body: { ok: true, value: null } }
    }
    return undefined
  }

  // --- Relations ---
  const relListMatch = /^\/projects\/([^/]+)\/relations$/.exec(pathname)
  const relOneMatch = /^\/projects\/([^/]+)\/relations\/([^/]+)$/.exec(pathname)
  if (relListMatch !== null && method === 'GET') {
    const projectId = decodeURIComponent(relListMatch[1] ?? '')
    return { status: 200, body: { ok: true, value: metadata.getRelations(projectId) } }
  }
  if (relOneMatch !== null) {
    const projectId = decodeURIComponent(relOneMatch[1] ?? '')
    const relId = decodeURIComponent(relOneMatch[2] ?? '')
    if (method === 'GET') {
      const rel = metadata.getRelation(relId)
      return rel === undefined ? { status: 404, body: failure('NOT_FOUND', 'Relation not found.') } : { status: 200, body: { ok: true, value: rel } }
    }
    if (method === 'PUT') {
      const body = await readJsonBody(request, signal)
      if (!isSafeRelationInput(metadata, projectId, body, relId)) {
        return { status: 400, body: failure('INVALID_ARGUMENT', 'Relation identity, endpoints, kind, and route project must be valid.') }
      }
      metadata.upsertRelation(body)
      return { status: 200, body: { ok: true, value: body } }
    }
    if (method === 'DELETE') {
      const existing = metadata.getRelation(relId)
      if (existing === undefined || String(existing.projectId) !== projectId) return { status: 404, body: failure('NOT_FOUND', 'Relation not found.') }
      metadata.deleteRelation(relId)
      return { status: 200, body: { ok: true, value: null } }
    }
    return undefined
  }

  // --- Notes ---
  const noteListMatch = /^\/projects\/([^/]+)\/notes$/.exec(pathname)
  const noteOneMatch = /^\/projects\/([^/]+)\/notes\/([^/]+)$/.exec(pathname)
  if (noteListMatch !== null) {
    const projectId = decodeURIComponent(noteListMatch[1] ?? '')
    if (method === 'GET') {
      return { status: 200, body: { ok: true, value: metadata.getNotes(projectId) } }
    }
    if (method === 'POST') {
      const body = await readJsonBody(request, signal)
      if (!isNote(body) || String(body.projectId) !== projectId) {
        return { status: 400, body: failure('INVALID_ARGUMENT', 'Note or NoteAnchor is invalid.') }
      }
      metadata.upsertNote(body)
      return { status: 200, body: { ok: true, value: body } }
    }
    return undefined
  }
  if (noteOneMatch !== null) {
    const projectId = decodeURIComponent(noteOneMatch[1] ?? '')
    const noteId = decodeURIComponent(noteOneMatch[2] ?? '')
    if (method === 'GET') {
      const note = metadata.getNote(noteId)
      return note === undefined ? { status: 404, body: failure('NOT_FOUND', 'Note not found.') } : { status: 200, body: { ok: true, value: note } }
    }
    if (method === 'PUT') {
      const body = await readJsonBody(request, signal)
      if (!isNote(body) || String(body.id) !== noteId || String(body.projectId) !== projectId || containsForbiddenPathKey(body)) {
        return { status: 400, body: failure('INVALID_ARGUMENT', 'Note or NoteAnchor is invalid.') }
      }
      metadata.upsertNote(body)
      return { status: 200, body: { ok: true, value: body } }
    }
    if (method === 'DELETE') {
      const existing = metadata.getNote(noteId)
      if (existing === undefined || String(existing.projectId) !== projectId) return { status: 404, body: failure('NOT_FOUND', 'Note not found.') }
      metadata.deleteNote(noteId)
      return { status: 200, body: { ok: true, value: null } }
    }
    return undefined
  }

  // --- ArtifactRevisions ---
  const revListMatch = /^\/artifacts\/([^/]+)\/revisions$/.exec(pathname)
  const revOneMatch = /^\/artifacts\/([^/]+)\/revisions\/([^/]+)$/.exec(pathname)
  if (revListMatch !== null && method === 'GET') {
    const artId = decodeURIComponent(revListMatch[1] ?? '')
    return { status: 200, body: { ok: true, value: metadata.getArtifactRevisions(artId) } }
  }
  if (revOneMatch !== null) {
    const revId = decodeURIComponent(revOneMatch[2] ?? '')
    if (method === 'GET') {
      const rev = metadata.getArtifactRevision(revId)
      return rev === undefined ? { status: 404, body: failure('NOT_FOUND', 'ArtifactRevision not found.') } : { status: 200, body: { ok: true, value: rev } }
    }
    return undefined
  }

  // --- PreviewRecords ---
  const previewListMatch = /^\/projects\/([^/]+)\/preview-records$/.exec(pathname)
  if (previewListMatch !== null && method === 'GET') {
    const projectId = decodeURIComponent(previewListMatch[1] ?? '')
    return { status: 200, body: { ok: true, value: metadata.getPreviewRecords(projectId) } }
  }
  const previewContentMatch = /^\/projects\/([^/]+)\/preview-records\/([^/]+)\/content$/.exec(pathname)
  if (previewContentMatch !== null && method === 'GET') {
    const projectId = decodeURIComponent(previewContentMatch[1] ?? '')
    const previewRecordId = decodeURIComponent(previewContentMatch[2] ?? '')
    const record = metadata.getPreviewRecord(previewRecordId)
    if (record === undefined || String(record.projectId) !== projectId) {
      return { status: 404, body: failure('NOT_FOUND', 'PreviewRecord not found.') }
    }
    if (record.status !== 'ready' || record.cachePath === '') {
      return { status: 409, body: failure('UNAVAILABLE', 'PreviewRecord content is not ready.') }
    }
    try {
      const bytes = await readFile(record.cachePath)
      return {
        status: 200,
        body: {
          ok: true,
          value: {
            previewRecordId: record.id,
            mimeType: record.mimeType,
            size: bytes.byteLength,
            encoding: 'base64',
            data: bytes.toString('base64'),
          },
        },
      }
    } catch (error: unknown) {
      return { status: 404, body: failure('NOT_FOUND', error instanceof Error ? error.message : 'Preview cache file not found.') }
    }
  }
  const previewGenerateMatch = /^\/projects\/([^/]+)\/previews$/.exec(pathname)
  if (previewGenerateMatch !== null && method === 'POST') {
    if (previewWorker === undefined) return { status: 503, body: failure('UNAVAILABLE', 'Preview worker is not configured.') }
    const projectId = decodeURIComponent(previewGenerateMatch[1] ?? '')
    const body = await readJsonBody(request, signal)
    if (!isRecord(body) || typeof body.revisionId !== 'string' || typeof body.previewProfile !== 'string'
      || 'path' in body || 'absolutePath' in body) {
      return { status: 400, body: failure('INVALID_ARGUMENT', 'Preview generation requires revisionId and previewProfile only.') }
    }
    try {
      const value = await previewWorker.generate({
        projectId: projectId as ProjectId,
        revisionId: body.revisionId as ArtifactRevisionId,
        previewProfile: body.previewProfile,
        signal,
      })
      return { status: 200, body: { ok: true, value } }
    } catch (error: unknown) {
      const aborted = error instanceof DOMException && error.name === 'AbortError'
      return {
        status: aborted ? 499 : 404,
        body: failure(aborted ? 'ABORTED' : 'NOT_FOUND', error instanceof Error ? error.message : 'Preview generation failed.'),
      }
    }
  }

  // --- Checkpoints ---
  const cpListMatch = /^\/projects\/([^/]+)\/checkpoints$/.exec(pathname)
  const cpOneMatch = /^\/projects\/([^/]+)\/checkpoints\/([^/]+)$/.exec(pathname)
  if (cpListMatch !== null) {
    const projectId = decodeURIComponent(cpListMatch[1] ?? '')
    if (method === 'GET') {
      return { status: 200, body: { ok: true, value: metadata.getCheckpoints(projectId) } }
    }
    if (method === 'POST') {
      const body = await readJsonBody(request, signal)
      if (!isCheckpoint(body) || String(body.projectId) !== projectId) {
        return { status: 400, body: failure('INVALID_ARGUMENT', 'Checkpoint command is invalid.') }
      }
      try {
        metadata.createCheckpoint(body)
        return { status: 201, body: { ok: true, value: body } }
      } catch (error: unknown) {
        return { status: 409, body: failure('VALIDATION', error instanceof Error ? error.message : 'Checkpoint could not be created.') }
      }
    }
    return undefined
  }
  if (cpOneMatch !== null) {
    const cpId = decodeURIComponent(cpOneMatch[2] ?? '')
    if (method === 'GET') {
      const cp = metadata.getCheckpoint(cpId)
      return cp === undefined ? { status: 404, body: failure('NOT_FOUND', 'Checkpoint not found.') } : { status: 200, body: { ok: true, value: cp } }
    }
    return undefined
  }

  return undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isNote(value: unknown): value is Note {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.projectId !== 'string'
    || typeof value.body !== 'string' || typeof value.createdAt !== 'string' || typeof value.updatedAt !== 'string'
    || !isRecord(value.anchor) || typeof value.anchor.type !== 'string') return false
  const anchor = value.anchor
  switch (anchor.type) {
    case 'project':
      return true
    case 'scope':
      return typeof anchor.scopeId === 'string'
    case 'artifact':
      return typeof anchor.artifactId === 'string'
    case 'artifact_view':
      return typeof anchor.viewId === 'string'
    case 'page':
      return typeof anchor.revisionId === 'string'
        && Number.isInteger(anchor.pageIndex)
        && (anchor.pageIndex as number) >= 0
    default:
      return false
  }
}

function isCheckpoint(value: unknown): value is Checkpoint {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.projectId === 'string'
    && typeof value.scopeId === 'string'
    && typeof value.label === 'string'
    && typeof value.createdAt === 'string'
    && 'snapshotJson' in value
}

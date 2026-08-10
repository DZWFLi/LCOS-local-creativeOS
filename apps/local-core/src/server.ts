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
import { composeLocalCoreServices } from './compose.js'
import { handleRuntimeReviewRoute } from './routes/runtime-reviews.js'
import { handleCanvasRoute } from './routes/canvas.js'
import { handleConnectorsRoute } from './routes/connectors.js'
import { handleContextProposalsRoute } from './routes/context-proposals.js'
import { handleConversationsRoute } from './routes/conversations.js'
import { handleEntityRoute } from './routes/entity.js'
import { handleExecutorRoute } from './routes/executor.js'
import { handleImportsRoute } from './routes/imports.js'
import { handleLcosprojRoute } from './routes/lcosproj.js'
import { handleProjectsRoute } from './routes/projects.js'
import { handleWorkbenchRoute } from './routes/workbench.js'
import { handleContextSnapshotsRoute } from './routes/context-snapshots.js'
import { handleHandoffsRoute } from './routes/handoffs.js'
import { handleResourcesRoute } from './routes/resources.js'
import { handleRuntimeRoute } from './routes/runtime.js'
import { handleRunsRoute } from './routes/runs.js'
import { handlePresentationsRoute } from './routes/presentations.js'
import { handleCurationRoute } from './routes/curation.js'
import { handleArtifactsRoute } from './routes/artifacts.js'
import { handleWorkspaceStatesRoute } from './routes/workspace-states.js'
import { FORBIDDEN_BROWSER_PATH_FIELDS, isRecord, isStringArray } from './routes/route-context.js'
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
  readonly workbenchService?: import('./workbench-service.js').WorkbenchService
  readonly contextSnapshotService?: import('./context-snapshot-service.js').ContextSnapshotService
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

  const services = composeLocalCoreServices(options)
  const {
    catalog, metadata, fileRegistry, fileObservation, importCopy, resources, packages, uploads,
    resourceReader, matcher, contextManifest, runtimeReview, runtimeApplication, activeContext,
    contextProposals, runEventListeners, obsidian, obsidianSessions, connectorRegistry,
    ownsConversationService, conversations, previewWorker, presentation, curation, search, curationCommand,
  } = services
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

      if (await handleConnectorsRoute({
        method,
        pathname,
        url,
        request,
        response,
        controller,
        metadata,
        connectorRegistry,
        obsidian,
        obsidianSessions,
        resources,
        directoryPicker: options.directoryPicker ?? selectNativeDirectory,
        helpers: routeHelpers,
      })) return
      if (await handleExecutorRoute({
        method,
        pathname,
        url,
        request,
        response,
        controller,
        metadata,
        bridgeProxy,
        helpers: routeHelpers,
      })) return
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
      if (await handleWorkbenchRoute({
        method,
        pathname,
        url,
        request,
        response,
        controller,
        metadata,
        helpers: routeHelpers,
        workbench: services.workbench,
      })) return
      if (await handleContextSnapshotsRoute({
        method,
        pathname,
        url,
        request,
        response,
        controller,
        metadata,
        helpers: routeHelpers,
        contextSnapshots: services.contextSnapshots,
      })) return
      if (await handleHandoffsRoute({
        method,
        pathname,
        url,
        request,
        response,
        controller,
        metadata,
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
      if (await handlePresentationsRoute({
        method,
        pathname,
        url,
        request,
        response,
        controller,
        metadata,
        presentation,
        helpers: routeHelpers,
      })) return
      if (await handleCurationRoute({
        method,
        pathname,
        url,
        request,
        response,
        controller,
        metadata,
        curation,
        curationCommand,
        search,
        helpers: routeHelpers,
      })) return
      if (await handleRuntimeRoute({
        method,
        pathname,
        url,
        request,
        response,
        controller,
        metadata,
        runtimeApplication,
        planCodexDispatch,
        helpers: routeHelpers,
      })) return
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

      if (await handleImportsRoute({
        method,
        pathname,
        url,
        request,
        response,
        controller,
        metadata,
        fileRegistry,
        importCopy,
        resources,
        maxImportBodyBytes: MAX_IMPORT_BODY_BYTES,
        helpers: routeHelpers,
      })) return
      if (await handleResourcesRoute({
        method,
        pathname,
        url,
        request,
        response,
        controller,
        metadata,
        uploads,
        packages,
        importCopy,
        resources,
        resourceReader,
        matcher,
        activeContext,
        maxImportBodyBytes: MAX_IMPORT_BODY_BYTES,
        createProjectIdFn: createProjectId,
        helpers: routeHelpers,
      })) return
      // ==================== Individual CRUD routes ====================

      const entityResult = await handleEntityRoute({
        method,
        pathname,
        metadata,
        fileObservation,
        previewWorker,
        request,
        signal: controller.signal,
        helpers: { failure, readJsonBody },
      })
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
        console.error('[LocalCore] Request failed:', error)
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


function validBearerToken(header: string | undefined, expected: string): boolean {
  if (header === undefined || !header.startsWith('Bearer ')) return false
  const actual = Buffer.from(header.slice('Bearer '.length), 'utf8')
  const expectedBytes = Buffer.from(expected, 'utf8')
  return actual.length === expectedBytes.length && timingSafeEqual(actual, expectedBytes)
}

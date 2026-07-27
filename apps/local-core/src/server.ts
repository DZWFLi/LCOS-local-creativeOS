import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'

import type {
  Artifact,
  ArtifactView,
  Checkpoint,
  ContractError,
  MutationBatch,
  Note,
  Project,
  ProjectGraphSnapshot,
  ProjectCatalog,
  Relation,
  RegisterTrustedSourceInput,
  Workspace,
  ValidateProjectRootInput,
} from '@local-creative-os/contracts'

import { failure } from './errors.js'
import { getHealthStatus } from './health.js'
import { ExplicitProjectCatalog } from './project-catalog.js'
import { validateProjectRoot } from './project-root.js'
import { MetadataForeignKeyConstraintError, SqliteMetadataRepository } from './metadata-repository.js'
import { FileRegistryService } from './file-registry-service.js'

const LOOPBACK_HOST = '127.0.0.1'
const MAX_BODY_BYTES = 1 * 1024 * 1024 // 1 MiB
export const LOCAL_CORE_DEV_PORT = 43121

export interface LocalCoreServerOptions {
  readonly host?: string
  readonly port?: number
  readonly catalog?: ProjectCatalog
  readonly allowedRoot?: string
  readonly requestTimeoutMs?: number
  readonly metadataRepository?: SqliteMetadataRepository
  readonly fileRegistryService?: FileRegistryService
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
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    if (signal.aborted) throw new DOMException('Request aborted', 'AbortError')
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > MAX_BODY_BYTES) throw new RangeError('Request body is too large')
    chunks.push(buffer)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
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
  if (!Number.isFinite(requestTimeoutMs) || requestTimeoutMs <= 0) {
    throw new Error('Local Core requestTimeoutMs must be a positive finite number.')
  }

  const catalog = options.catalog ?? new ExplicitProjectCatalog([])
  const metadata = options.metadataRepository
  const fileRegistry = options.fileRegistryService
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

      // ---- Health ----
      if (method === 'GET' && pathname === '/health') {
        sendJson(response, 200, getHealthStatus())
        return
      }

      // ---- Project Catalog ----
      if (method === 'GET' && pathname === '/projects') {
        const result = metadata === undefined
          ? await withAbort(catalog.list(controller.signal), controller.signal)
          : { ok: true as const, value: metadata.listProjects().map((p) => ({ id: p.id, name: p.name, rootPath: p.rootPath })) }
        sendJson(response, result.ok ? 200 : statusForError(result.error.code), result)
        return
      }

      // ---- Metadata Status ----
      if (method === 'GET' && pathname === '/metadata/status') {
        if (!requireMetadata(metadata, response)) return
        sendJson(response, 200, {
          ok: true,
          value: { schemaVersion: metadata.schemaVersion, databasePath: metadata.databasePath, metadataOnly: true },
        })
        return
      }

      // ---- Project Root Validation ----
      if (method === 'POST' && pathname === '/project-roots/validate') {
        let input: unknown
        try { input = await readJsonBody(request, controller.signal) } catch {
          sendJson(response, 400, failure('INVALID_ARGUMENT', 'Request body must be valid JSON under 64 KiB.'))
          return
        }
        if (typeof input !== 'object' || input === null || !('rootPath' in input) || typeof input.rootPath !== 'string') {
          sendJson(response, 400, failure('INVALID_ARGUMENT', 'rootPath must be a string.'))
          return
        }
        const result = await withAbort(
          validateProjectRoot((input as ValidateProjectRootInput).rootPath, {
            signal: controller.signal,
            ...(options.allowedRoot === undefined ? {} : { allowedRoot: options.allowedRoot }),
          }),
          controller.signal,
        )
        sendJson(response, result.ok ? 200 : statusForError(result.error.code), result)
        return
      }

      // ==================== Project Graph (snapshot) ====================
      const graphMatch = /^\/projects\/([^/]+)\/graph$/.exec(pathname)
      if (method === 'GET' && graphMatch !== null) {
        if (!requireMetadata(metadata, response)) return
        const projectId = decodeURIComponent(graphMatch[1] ?? '')
        if (!requireProject(projectId, metadata, response)) return
        const snapshot = metadata.get(projectId)
        sendJson(response, 200, { ok: true, value: snapshot })
        return
      }
      if (method === 'PUT' && graphMatch !== null) {
        if (!requireMetadata(metadata, response)) return
        let input: unknown
        try { input = await readJsonBody(request, controller.signal) } catch {
          sendJson(response, 400, failure('INVALID_ARGUMENT', 'Request body must be valid JSON.'))
          return
        }
        if (typeof input !== 'object' || input === null || !('snapshot' in input) || typeof input.snapshot !== 'object' || input.snapshot === null) {
          sendJson(response, 400, failure('INVALID_ARGUMENT', 'A project snapshot is required.'))
          return
        }
        const saveInput = input as { snapshot: ProjectGraphSnapshot }
        const projectId = decodeURIComponent(graphMatch[1] ?? '')
        if (String(saveInput.snapshot.project.id) !== projectId) {
          sendJson(response, 400, failure('INVALID_ARGUMENT', 'Route project id must match snapshot project id.'))
          return
        }
        try {
          metadata.save(saveInput.snapshot)
          sendJson(response, 200, { ok: true, value: metadata.get(projectId) })
        } catch (error: unknown) {
          sendJson(response, 400, failure('VALIDATION', formatMetadataError(error, 'Metadata could not be saved.')))
        }
        return
      }
      if (method === 'POST' && graphMatch !== null) {
        if (!requireMetadata(metadata, response)) return
        let input: unknown
        try { input = await readJsonBody(request, controller.signal) } catch {
          sendJson(response, 400, failure('INVALID_ARGUMENT', 'Request body must be valid JSON.'))
          return
        }
        if (typeof input !== 'object' || input === null || !('baseVersion' in input) || !('ops' in input) || !Array.isArray((input as { ops: unknown }).ops)) {
          sendJson(response, 400, failure('INVALID_ARGUMENT', 'A mutation batch with baseVersion and ops is required.'))
          return
        }
        const batch = input as unknown as MutationBatch
        const projectId = decodeURIComponent(graphMatch[1] ?? '')
        try {
          const graphVersion = metadata.applyMutations(batch, projectId)
          sendJson(response, 200, { ok: true, value: { appliedOps: batch.ops.length, graphVersion } })
        } catch (error: unknown) {
          const msg = formatMetadataError(error, 'Mutations could not be applied.')
          const code = (error instanceof Error && 'code' in error) ? String((error as unknown as Record<string, unknown>).code) : undefined
          if (code === 'STALE_GRAPH_VERSION') {
            sendJson(response, 409, { ok: false, error: { code: 'STALE_GRAPH_VERSION' as ContractError['code'], message: msg, retryable: true, origin: 'runtime' as const } })
          } else {
            sendJson(response, 400, failure('VALIDATION', msg))
          }
        }
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

      // ==================== Individual CRUD routes ====================

      const entityResult = await handleEntityRoute(method, pathname, metadata, request, controller.signal)
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
    },

    address(): LocalCoreAddress | undefined { return currentAddress },
  }

  return api
}

// ==================== Entity route handler ====================

type RouteResult = { status: number; body: unknown } | undefined

async function handleEntityRoute(
  method: string,
  pathname: string,
  metadata: SqliteMetadataRepository | undefined,
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
      const ws = body as Workspace
      if (!ws.id || !ws.projectId) return { status: 400, body: failure('INVALID_ARGUMENT', 'Workspace must have id and projectId.') }
      metadata.upsertWorkspace(ws)
      return { status: 200, body: { ok: true, value: ws } }
    }
    return undefined
  }
  if (wsOneMatch !== null) {
    const wsId = decodeURIComponent(wsOneMatch[2] ?? '')
    if (method === 'GET') {
      const ws = metadata.getWorkspace(wsId)
      return ws === undefined ? { status: 404, body: failure('NOT_FOUND', 'Workspace not found.') } : { status: 200, body: { ok: true, value: ws } }
    }
    if (method === 'PUT') {
      const body = await readJsonBody(request, signal)
      metadata.upsertWorkspace(body as Workspace)
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
    const artId = decodeURIComponent(artOneMatch[2] ?? '')
    if (method === 'GET') {
      const art = metadata.getArtifact(artId)
      return art === undefined ? { status: 404, body: failure('NOT_FOUND', 'Artifact not found.') } : { status: 200, body: { ok: true, value: art } }
    }
    if (method === 'PUT') {
      const body = await readJsonBody(request, signal)
      metadata.upsertArtifact(body as Artifact)
      return { status: 200, body: { ok: true, value: body } }
    }
    return undefined
  }

  // --- FileRecords (read-only by ID; paths are never accepted from Browser) ---
  const fileListMatch = /^\/projects\/([^/]+)\/file-records$/.exec(pathname)
  const fileOneMatch = /^\/file-records\/([^/]+)$/.exec(pathname)
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

  // --- ArtifactViews ---
  const avListMatch = /^\/projects\/([^/]+)\/artifact-views$/.exec(pathname)
  const avOneMatch = /^\/projects\/([^/]+)\/artifact-views\/([^/]+)$/.exec(pathname)
  if (avListMatch !== null && method === 'GET') {
    const projectId = decodeURIComponent(avListMatch[1] ?? '')
    return { status: 200, body: { ok: true, value: metadata.getArtifactViews(projectId) } }
  }
  if (avOneMatch !== null) {
    const viewId = decodeURIComponent(avOneMatch[2] ?? '')
    if (method === 'GET') {
      const view = metadata.getArtifactView(viewId)
      return view === undefined ? { status: 404, body: failure('NOT_FOUND', 'ArtifactView not found.') } : { status: 200, body: { ok: true, value: view } }
    }
    if (method === 'PUT') {
      const body = await readJsonBody(request, signal)
      const view = body as ArtifactView
      metadata.upsertArtifactView(view)
      return { status: 200, body: { ok: true, value: view } }
    }
    if (method === 'DELETE') {
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
    const relId = decodeURIComponent(relOneMatch[2] ?? '')
    if (method === 'GET') {
      const rel = metadata.getRelation(relId)
      return rel === undefined ? { status: 404, body: failure('NOT_FOUND', 'Relation not found.') } : { status: 200, body: { ok: true, value: rel } }
    }
    if (method === 'PUT') {
      const body = await readJsonBody(request, signal)
      metadata.upsertRelation(body as Relation)
      return { status: 200, body: { ok: true, value: body } }
    }
    if (method === 'DELETE') {
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
    const noteId = decodeURIComponent(noteOneMatch[2] ?? '')
    if (method === 'GET') {
      const note = metadata.getNote(noteId)
      return note === undefined ? { status: 404, body: failure('NOT_FOUND', 'Note not found.') } : { status: 200, body: { ok: true, value: note } }
    }
    if (method === 'PUT') {
      const body = await readJsonBody(request, signal)
      if (!isNote(body) || String(body.id) !== noteId) {
        return { status: 400, body: failure('INVALID_ARGUMENT', 'Note or NoteAnchor is invalid.') }
      }
      metadata.upsertNote(body)
      return { status: 200, body: { ok: true, value: body } }
    }
    if (method === 'DELETE') {
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

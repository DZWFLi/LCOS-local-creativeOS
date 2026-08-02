import type {
  AcceptArtifactReturnInput,
  AcceptArtifactReturnResult,
  ContractError,
  ContextManifestV0,
  HealthStatus,
  MetadataStoreStatus,
  MutationBatch,
  MutationResult,
  ProjectCatalogEntry,
  ProjectGraphSnapshot,
  PreviewRecord,
  RejectArtifactReturnResult,
  ImportResourceResultV1,
  ResourceDescriptorV0,
  Result,
  RetryRunInput,
  RetryRunResult,
  RunReview,
  ValidatedProjectRoot,
} from '@local-creative-os/contracts'

export const LOCAL_CORE_API_PREFIX = '/api/local-core/v1'
export const LOCAL_CORE_REQUEST_TIMEOUT_MS = 2_500

export interface RuntimeCall<Value> {
  readonly result: Result<Value>
  readonly origin: 'runtime'
  readonly latencyMs: number
  readonly requestedAt: string
}

export interface StructuredTestReport {
  readonly numTotalTestSuites?: number
  readonly numPassedTestSuites?: number
  readonly numFailedTestSuites?: number
  readonly numTotalTests?: number
  readonly numPassedTests?: number
  readonly numFailedTests?: number
  readonly startTime?: number
  readonly success?: boolean
  readonly testResults?: readonly unknown[]
}

export interface GeneratePreviewResult {
  readonly record: PreviewRecord
  readonly reused: boolean
}

export interface PreviewContentResult {
  readonly previewRecordId: string
  readonly mimeType: string
  readonly size: number
  readonly encoding: 'base64'
  readonly data: string
}

export interface ImportCopyResult {
  readonly fileRecord: ProjectGraphSnapshot['fileRecords'][number]
  readonly artifact: ProjectGraphSnapshot['artifacts'][number]
  readonly revision: ProjectGraphSnapshot['artifactRevisions'][number]
  readonly view: ProjectGraphSnapshot['artifactViews'][number]
  readonly reused: boolean
}

export interface FileObservationResult {
  readonly fileRecord: ProjectGraphSnapshot['fileRecords'][number]
  readonly artifact?: ProjectGraphSnapshot['artifacts'][number]
  readonly previousAvailability: ProjectGraphSnapshot['fileRecords'][number]['availability']
  readonly changed: boolean
  readonly revisionCreated: false
}

export interface AdoptExternalChangeResult {
  readonly fileRecord: ProjectGraphSnapshot['fileRecords'][number]
  readonly artifact: ProjectGraphSnapshot['artifacts'][number]
  readonly previousRevision: ProjectGraphSnapshot['artifactRevisions'][number]
  readonly revision: ProjectGraphSnapshot['artifactRevisions'][number]
  readonly updatedViews: readonly ProjectGraphSnapshot['artifactViews'][number][]
}

export interface CreateRuntimeRunInput {
  readonly instruction: string
  readonly targetArtifactId: string
  readonly contextArtifactIds?: readonly string[]
  readonly workspaceId?: string
}

export interface RuntimeRunActionResult {
  readonly review: RunReview
  readonly providerError?: {
    readonly code: string
    readonly message: string
    readonly retryable: boolean
    readonly provider: 'workbuddy'
  }
}

export interface ActiveContextProjection {
  readonly projectId: string
  readonly workspaceId?: string
  readonly scopeId: string
  readonly selectedViewIds: readonly string[]
  readonly pinnedContextIds: readonly string[]
  readonly excludedContextIds: readonly string[]
  readonly version: number
  readonly updatedAt: string
  readonly selectedArtifacts: readonly {
    readonly viewId: string
    readonly artifactId: string
    readonly title: string
    readonly kind: string
    readonly revisionId?: string
  }[]
  readonly contextArtifacts: readonly {
    readonly viewId: string
    readonly artifactId: string
    readonly title: string
    readonly kind: string
    readonly revisionId?: string
  }[]
}

export interface LocalCoreClient {
  health(signal?: AbortSignal): Promise<RuntimeCall<HealthStatus>>
  catalog(signal?: AbortSignal): Promise<RuntimeCall<readonly ProjectCatalogEntry[]>>
  validateProjectRoot(rootPath: string, signal?: AbortSignal): Promise<RuntimeCall<ValidatedProjectRoot>>
  selectDirectory(title: string, signal?: AbortSignal): Promise<RuntimeCall<{ readonly path?: string; readonly cancelled: boolean }>>
  inspectProjectRoot(rootPath: string, signal?: AbortSignal): Promise<RuntimeCall<{ readonly fileCount: number; readonly directoryCount: number; readonly totalBytes: number; readonly skipped: readonly string[]; readonly requiresConfirmation: boolean }>>
  importResourceUrl(projectId: string, input: {
    readonly url: string
    readonly title?: string
    readonly note?: string
    readonly scopeId: string
    readonly x: number
    readonly y: number
    readonly importRequestId?: string
  }, signal?: AbortSignal): Promise<RuntimeCall<ImportResourceResultV1>>
  resourceList(projectId: string, signal?: AbortSignal): Promise<RuntimeCall<readonly {
    readonly resourceId: string
    readonly artifactId: string
    readonly title: string
    readonly status: string
    readonly analyzerVersion: string
  }[]>>
  resourceDescriptor(projectId: string, resourceId: string, signal?: AbortSignal): Promise<RuntimeCall<ResourceDescriptorV0>>
  resourceReanalyze(projectId: string, resourceId: string, signal?: AbortSignal): Promise<RuntimeCall<ResourceDescriptorV0>>
  resourceRead(projectId: string, resourceId: string, input: {
    readonly path?: string
    readonly limit?: number
  }, signal?: AbortSignal): Promise<RuntimeCall<{
    readonly resourceId: string
    readonly fileName: string
    readonly mimeType?: string
    readonly contentHash?: string
    readonly size: number
    readonly offset: number
    readonly limit: number
    readonly truncated: boolean
    readonly format: string
    readonly data: string
  }>>
  importResourceDirectory(projectId: string, input: {
    readonly importRequestId: string
    readonly rootName: string
    readonly files: readonly { readonly path: string; readonly file: File }[]
    readonly scopeId: string
    readonly x: number
    readonly y: number
    readonly note?: string
  }, signal?: AbortSignal): Promise<RuntimeCall<ImportResourceResultV1>>
  importResourceArchive(projectId: string, input: {
    readonly file: File
    readonly importRequestId: string
    readonly scopeId: string
    readonly x: number
    readonly y: number
    readonly note?: string
  }, signal?: AbortSignal): Promise<RuntimeCall<ImportResourceResultV1>>
  createProject(input: {
    readonly name: string
  } & (
    | { readonly intent: 'create'; readonly parentPath: string; readonly directoryName: string }
    | { readonly intent: 'open'; readonly rootPath: string; readonly importExisting?: boolean }
  ), signal?: AbortSignal): Promise<RuntimeCall<ProjectCatalogEntry>>
  metadataStatus(signal?: AbortSignal): Promise<RuntimeCall<MetadataStoreStatus>>
  projectGraph(projectId: string, signal?: AbortSignal): Promise<RuntimeCall<ProjectGraphSnapshot>>
  updateActiveContext(projectId: string, input: {
    readonly workspaceId?: string
    readonly scopeId: string
    readonly selectedViewIds: readonly string[]
    readonly pinnedContextIds: readonly string[]
    readonly excludedContextIds: readonly string[]
  }, signal?: AbortSignal): Promise<RuntimeCall<ActiveContextProjection>>
  previewRecords(projectId: string, signal?: AbortSignal): Promise<RuntimeCall<readonly PreviewRecord[]>>
  previewContent(projectId: string, previewRecordId: string, signal?: AbortSignal): Promise<RuntimeCall<PreviewContentResult>>
  generatePreview(projectId: string, revisionId: string, previewProfile: string, signal?: AbortSignal): Promise<RuntimeCall<GeneratePreviewResult>>
  importCopy(projectId: string, input: { readonly file: File; readonly importRequestId: string; readonly scopeId: string; readonly x: number; readonly y: number }, signal?: AbortSignal): Promise<RuntimeCall<ImportCopyResult>>
  buildContextManifest(projectId: string, input?: { readonly targetArtifactId?: string; readonly contextArtifactIds?: readonly string[]; readonly requestedOutput?: string }, signal?: AbortSignal): Promise<RuntimeCall<ContextManifestV0>>
  createRuntimeRun(projectId: string, input: CreateRuntimeRunInput, signal?: AbortSignal): Promise<RuntimeCall<RuntimeRunActionResult>>
  projectRunReviews(projectId: string, limit?: number, signal?: AbortSignal): Promise<RuntimeCall<readonly RunReview[]>>
  dispatchRuntimeRun(runId: string, signal?: AbortSignal): Promise<RuntimeCall<RuntimeRunActionResult>>
  recoverRuntimeRun(runId: string, signal?: AbortSignal): Promise<RuntimeCall<RuntimeRunActionResult>>
  syncRuntimeRun(runId: string, signal?: AbortSignal): Promise<RuntimeCall<RuntimeRunActionResult>>
  finalizeRuntimeRun(runId: string, decision: 'completed' | 'retrying', comment?: string, signal?: AbortSignal): Promise<RuntimeCall<RuntimeRunActionResult>>
  getRunReview(runId: string, signal?: AbortSignal): Promise<RuntimeCall<RunReview>>
  acceptArtifactReturn(returnId: string, input: AcceptArtifactReturnInput, signal?: AbortSignal): Promise<RuntimeCall<AcceptArtifactReturnResult>>
  rejectArtifactReturn(returnId: string, signal?: AbortSignal): Promise<RuntimeCall<RejectArtifactReturnResult>>
  retryArtifactReturn(returnId: string, input?: RetryRunInput, signal?: AbortSignal): Promise<RuntimeCall<RetryRunResult>>
  refreshFileRecord(fileRecordId: string, signal?: AbortSignal): Promise<RuntimeCall<FileObservationResult>>
  adoptExternalChange(fileRecordId: string, signal?: AbortSignal): Promise<RuntimeCall<AdoptExternalChangeResult>>
  applyMutations(batch: MutationBatch, projectId: string, signal?: AbortSignal): Promise<RuntimeCall<MutationResult>>
  saveProjectGraph(snapshot: ProjectGraphSnapshot, signal?: AbortSignal): Promise<RuntimeCall<ProjectGraphSnapshot>>
}

function runtimeError(
  code: ContractError['code'],
  message: string,
  retryable: boolean,
): ContractError {
  return { code, message, retryable, origin: 'runtime' }
}

function isHealthStatus(value: unknown): value is HealthStatus {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<HealthStatus>
  return (
    candidate.status === 'ok'
    && candidate.service === 'local-core'
    && (candidate.mode === 'read_only_phase_1a' || candidate.mode === 'phase_2_lite')
    && typeof candidate.version === 'string'
  )
}

function isFailure(value: unknown): value is Extract<Result<never>, { readonly ok: false }> {
  if (typeof value !== 'object' || value === null || !('ok' in value) || value.ok !== false) return false
  if (!('error' in value) || typeof value.error !== 'object' || value.error === null) return false
  const error = value.error as Partial<ContractError>
  return (
    typeof error.code === 'string'
    && typeof error.message === 'string'
    && typeof error.retryable === 'boolean'
    && (error.origin === 'runtime' || error.origin === 'fixture')
  )
}

async function request<Value>(
  path: string,
  options: {
    readonly init?: RequestInit
    readonly signal?: AbortSignal
    readonly timeoutMs?: number
    decode(value: unknown): Result<Value>
  },
): Promise<RuntimeCall<Value>> {
  const startedAt = performance.now()
  const requestedAt = new Date().toISOString()
  const controller = new AbortController()
  let timedOut = false
  const timeout = globalThis.setTimeout(() => {
    timedOut = true
    controller.abort()
  }, options.timeoutMs ?? LOCAL_CORE_REQUEST_TIMEOUT_MS)
  const abort = () => controller.abort()
  options.signal?.addEventListener('abort', abort, { once: true })

  try {
    const headers = new Headers(options.init?.headers)
    headers.set('accept', 'application/json')
    const response = await fetch(`${LOCAL_CORE_API_PREFIX}${path}`, {
      ...options.init,
      signal: controller.signal,
      headers,
    })
    const body: unknown = await response.json()
    const result = options.decode(body)
    if (!response.ok && result.ok) {
      return {
        result: {
          ok: false,
          error: runtimeError('UNAVAILABLE', `Local Core returned HTTP ${response.status}.`, true),
        },
        origin: 'runtime',
        latencyMs: Math.round((performance.now() - startedAt) * 10) / 10,
        requestedAt,
      }
    }
    return {
      result,
      origin: 'runtime',
      latencyMs: Math.round((performance.now() - startedAt) * 10) / 10,
      requestedAt,
    }
  } catch (error: unknown) {
    const aborted = error instanceof DOMException && error.name === 'AbortError'
    return {
      result: {
        ok: false,
        error: runtimeError(
          aborted ? 'ABORTED' : 'UNAVAILABLE',
          timedOut
            ? 'Local Core request timed out.'
            : aborted
              ? 'Local Core request was aborted.'
              : 'Local Core is offline or the development proxy is unavailable.',
          !aborted,
        ),
      },
      origin: 'runtime',
      latencyMs: Math.round((performance.now() - startedAt) * 10) / 10,
      requestedAt,
    }
  } finally {
    globalThis.clearTimeout(timeout)
    options.signal?.removeEventListener('abort', abort)
  }
}

function decodeHealth(value: unknown): Result<HealthStatus> {
  if (isHealthStatus(value)) return { ok: true, value }
  if (isFailure(value)) return value
  return {
    ok: false,
    error: runtimeError('UNAVAILABLE', 'Local Core health response has an unexpected shape.', false),
  }
}

function decodeResult<Value>(value: unknown): Result<Value> {
  if (isFailure(value)) return value
  if (typeof value === 'object' && value !== null && 'ok' in value && value.ok === true && 'value' in value) {
    return { ok: true, value: value.value as Value }
  }
  return {
    ok: false,
    error: runtimeError('UNAVAILABLE', 'Local Core response has an unexpected shape.', false),
  }
}

export function createLocalCoreClient(): LocalCoreClient {
  return {
    health(signal) {
      return request('/health', { signal, decode: decodeHealth })
    },
    catalog(signal) {
      return request('/projects', {
        signal,
        decode: decodeResult<readonly ProjectCatalogEntry[]>,
      })
    },
    validateProjectRoot(rootPath, signal) {
      return request('/project-roots/validate', {
        signal,
        init: {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ rootPath }),
        },
        decode: decodeResult<ValidatedProjectRoot>,
      })
    },
    selectDirectory(title, signal) {
      return request('/system/select-directory', {
        signal,
        timeoutMs: 5 * 60 * 1_000,
        init: {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ title }),
        },
        decode: decodeResult<{ readonly path?: string; readonly cancelled: boolean }>,
      })
    },
    inspectProjectRoot(rootPath, signal) {
      return request('/project-roots/inspect', {
        signal,
        timeoutMs: 60_000,
        init: { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ rootPath }) },
        decode: decodeResult<{ readonly fileCount: number; readonly directoryCount: number; readonly totalBytes: number; readonly skipped: readonly string[]; readonly requiresConfirmation: boolean }>,
      })
    },
    createProject(input, signal) {
      return request('/projects', {
        signal,
        init: {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(input),
        },
        decode: decodeResult<ProjectCatalogEntry>,
      })
    },
    importResourceUrl(projectId, input, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/resources/import-url`, {
        signal,
        init: {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(input),
        },
        decode: decodeResult<ImportResourceResultV1>,
      })
    },
    resourceList(projectId, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/resources`, {
        signal,
        decode: decodeResult<readonly {
          readonly resourceId: string
          readonly artifactId: string
          readonly title: string
          readonly status: string
          readonly analyzerVersion: string
        }[]>,
      })
    },
    resourceDescriptor(projectId, resourceId, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/resources/${encodeURIComponent(resourceId)}/descriptor`, {
        signal,
        decode: decodeResult<ResourceDescriptorV0>,
      })
    },
    resourceReanalyze(projectId, resourceId, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/resources/${encodeURIComponent(resourceId)}/reanalyze`, {
        signal,
        init: { method: 'POST' },
        decode: decodeResult<ResourceDescriptorV0>,
      })
    },
    resourceRead(projectId, resourceId, input, signal) {
      const query = new URLSearchParams()
      if (input.path !== undefined) query.set('path', input.path)
      if (input.limit !== undefined) query.set('limit', String(input.limit))
      const suffix = query.size === 0 ? '' : `?${query.toString()}`
      return request(`/projects/${encodeURIComponent(projectId)}/resources/${encodeURIComponent(resourceId)}/content${suffix}`, {
        signal,
        decode: decodeResult<{
          readonly resourceId: string
          readonly fileName: string
          readonly mimeType?: string
          readonly contentHash?: string
          readonly size: number
          readonly offset: number
          readonly limit: number
          readonly truncated: boolean
          readonly format: string
          readonly data: string
        }>,
      })
    },
    async importResourceDirectory(projectId, input, signal) {
      const started = await request<{ sessionId: string }>(`/projects/${encodeURIComponent(projectId)}/resource-upload-sessions`, {
        signal,
        init: {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ importRequestId: input.importRequestId, rootName: input.rootName, scopeId: input.scopeId, x: input.x, y: input.y, ...(input.note === undefined ? {} : { note: input.note }) }),
        },
        decode: decodeResult<{ sessionId: string }>,
      })
      if (!started.result.ok) return { ...started, result: started.result }
      const sessionId = started.result.value.sessionId
      for (const entry of input.files) {
        const uploaded = await request<null>(`/projects/${encodeURIComponent(projectId)}/resource-upload-sessions/${encodeURIComponent(sessionId)}/files?path=${encodeURIComponent(entry.path)}`, {
          signal, timeoutMs: 30_000, init: { method: 'PUT', headers: { 'content-type': 'application/octet-stream' }, body: entry.file }, decode: decodeResult<null>,
        })
        if (!uploaded.result.ok) return { ...uploaded, result: uploaded.result }
      }
      return request(`/projects/${encodeURIComponent(projectId)}/resource-upload-sessions/${encodeURIComponent(sessionId)}/complete`, {
        signal, timeoutMs: 30_000, init: { method: 'POST' }, decode: decodeResult<ImportResourceResultV1>,
      })
    },
    importResourceArchive(projectId, input, signal) {
      const body = new FormData()
      body.set('file', input.file)
      body.set('importRequestId', input.importRequestId)
      body.set('scopeId', input.scopeId)
      body.set('position.x', String(input.x))
      body.set('position.y', String(input.y))
      if (input.note !== undefined) body.set('note', input.note)
      return request(`/projects/${encodeURIComponent(projectId)}/resources/import-archive`, {
        signal,
        timeoutMs: 30_000,
        init: { method: 'POST', body },
        decode: decodeResult<ImportResourceResultV1>,
      })
    },
    metadataStatus(signal) {
      return request('/metadata/status', { signal, decode: decodeResult<MetadataStoreStatus> })
    },
    projectGraph(projectId, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/graph`, {
        signal,
        decode: decodeResult<ProjectGraphSnapshot>,
      })
    },
    previewRecords(projectId, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/preview-records`, {
        signal,
        decode: decodeResult<readonly PreviewRecord[]>,
      })
    },
    previewContent(projectId, previewRecordId, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/preview-records/${encodeURIComponent(previewRecordId)}/content`, {
        signal,
        timeoutMs: 5_000,
        decode: decodeResult<PreviewContentResult>,
      })
    },
    generatePreview(projectId, revisionId, previewProfile, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/previews`, {
        signal,
        init: {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ revisionId, previewProfile }),
        },
        decode: decodeResult<GeneratePreviewResult>,
      })
    },
    updateActiveContext(projectId, input, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/active-context`, {
        signal,
        init: {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(input),
        },
        decode: decodeResult<ActiveContextProjection>,
      })
    },
    importCopy(projectId, input, signal) {
      const body = new FormData()
      body.set('file', input.file)
      body.set('importRequestId', input.importRequestId)
      body.set('scopeId', input.scopeId)
      body.set('position.x', String(input.x))
      body.set('position.y', String(input.y))
      body.set('sourceKind', 'import_copy')
      return request(`/projects/${encodeURIComponent(projectId)}/imports`, {
        signal,
        timeoutMs: 30_000,
        init: {
          method: 'POST',
          body,
        },
        decode: decodeResult<ImportCopyResult>,
      })
    },
    buildContextManifest(projectId, input = {}, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/context-manifests/v0`, {
        signal,
        init: {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(input),
        },
        decode: decodeResult<ContextManifestV0>,
      })
    },
    createRuntimeRun(projectId, input, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/runs`, {
        signal,
        timeoutMs: 15_000,
        init: {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(input),
        },
        decode: decodeResult<RuntimeRunActionResult>,
      })
    },
    projectRunReviews(projectId, limit = 20, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/runs?limit=${encodeURIComponent(String(limit))}`, {
        signal,
        decode: decodeResult<readonly RunReview[]>,
      })
    },
    dispatchRuntimeRun(runId, signal) {
      return request(`/runs/${encodeURIComponent(runId)}/dispatch`, {
        signal,
        timeoutMs: 15_000,
        init: { method: 'POST' },
        decode: decodeResult<RuntimeRunActionResult>,
      })
    },
    recoverRuntimeRun(runId, signal) {
      return request(`/runs/${encodeURIComponent(runId)}/recover`, {
        signal,
        timeoutMs: 15_000,
        init: { method: 'POST' },
        decode: decodeResult<RuntimeRunActionResult>,
      })
    },
    syncRuntimeRun(runId, signal) {
      return request(`/runs/${encodeURIComponent(runId)}/sync`, {
        signal,
        timeoutMs: 15_000,
        init: { method: 'POST' },
        decode: decodeResult<RuntimeRunActionResult>,
      })
    },
    finalizeRuntimeRun(runId, decision, comment, signal) {
      return request(`/runs/${encodeURIComponent(runId)}/finalize`, {
        signal,
        timeoutMs: 15_000,
        init: {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ decision, ...(comment === undefined ? {} : { comment }) }),
        },
        decode: decodeResult<RuntimeRunActionResult>,
      })
    },
    getRunReview(runId, signal) {
      return request(`/runs/${encodeURIComponent(runId)}/review`, {
        signal,
        decode: decodeResult<RunReview>,
      })
    },
    acceptArtifactReturn(returnId, input, signal) {
      return request(`/artifact-returns/${encodeURIComponent(returnId)}/accept`, {
        signal,
        init: {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(input),
        },
        decode: decodeResult<AcceptArtifactReturnResult>,
      })
    },
    rejectArtifactReturn(returnId, signal) {
      return request(`/artifact-returns/${encodeURIComponent(returnId)}/reject`, {
        signal,
        init: { method: 'POST' },
        decode: decodeResult<RejectArtifactReturnResult>,
      })
    },
    retryArtifactReturn(returnId, input = {}, signal) {
      return request(`/artifact-returns/${encodeURIComponent(returnId)}/retry`, {
        signal,
        init: {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(input),
        },
        decode: decodeResult<RetryRunResult>,
      })
    },
    refreshFileRecord(fileRecordId, signal) {
      return request(`/file-records/${encodeURIComponent(fileRecordId)}/refresh`, {
        signal,
        init: { method: 'POST' },
        decode: decodeResult<FileObservationResult>,
      })
    },
    adoptExternalChange(fileRecordId, signal) {
      return request(`/file-records/${encodeURIComponent(fileRecordId)}/adopt`, {
        signal,
        init: { method: 'POST' },
        decode: decodeResult<AdoptExternalChangeResult>,
      })
    },
    saveProjectGraph(snapshot, signal) {
      return request(`/projects/${encodeURIComponent(snapshot.project.id)}/graph`, {
        signal,
        init: {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ snapshot }),
        },
        decode: decodeResult<ProjectGraphSnapshot>,
      })
    },
    applyMutations(batch, projectId, signal) {
      return request(`/projects/${encodeURIComponent(projectId)}/graph`, {
        signal,
        init: {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(batch),
        },
        decode: decodeResult<MutationResult>,
      })
    },
  }
}

export async function loadStructuredTestReport(signal?: AbortSignal): Promise<Result<StructuredTestReport>> {
  try {
    const response = await fetch('/dev-test-report.json', {
      signal,
      headers: { accept: 'application/json' },
      cache: 'no-store',
    })
    if (!response.ok) {
      return {
        ok: false,
        error: runtimeError(
          'NOT_FOUND',
          'No generated test report. Run npm run test:report.',
          true,
        ),
      }
    }
    const value: unknown = await response.json()
    if (typeof value !== 'object' || value === null) {
      return {
        ok: false,
        error: runtimeError('UNAVAILABLE', 'Test report JSON has an unexpected shape.', false),
      }
    }
    return { ok: true, value: value as StructuredTestReport }
  } catch (error: unknown) {
    const aborted = error instanceof DOMException && error.name === 'AbortError'
    return {
      ok: false,
      error: runtimeError(
        aborted ? 'ABORTED' : 'UNAVAILABLE',
        aborted ? 'Test report request was aborted.' : 'Test report is unavailable.',
        !aborted,
      ),
    }
  }
}

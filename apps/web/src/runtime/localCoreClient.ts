import type {
  ContractError,
  HealthStatus,
  MetadataStoreStatus,
  MutationBatch,
  MutationResult,
  ProjectCatalogEntry,
  ProjectGraphSnapshot,
  PreviewRecord,
  Result,
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

export interface LocalCoreClient {
  health(signal?: AbortSignal): Promise<RuntimeCall<HealthStatus>>
  catalog(signal?: AbortSignal): Promise<RuntimeCall<readonly ProjectCatalogEntry[]>>
  validateProjectRoot(rootPath: string, signal?: AbortSignal): Promise<RuntimeCall<ValidatedProjectRoot>>
  metadataStatus(signal?: AbortSignal): Promise<RuntimeCall<MetadataStoreStatus>>
  projectGraph(projectId: string, signal?: AbortSignal): Promise<RuntimeCall<ProjectGraphSnapshot>>
  previewRecords(projectId: string, signal?: AbortSignal): Promise<RuntimeCall<readonly PreviewRecord[]>>
  previewContent(projectId: string, previewRecordId: string, signal?: AbortSignal): Promise<RuntimeCall<PreviewContentResult>>
  generatePreview(projectId: string, revisionId: string, previewProfile: string, signal?: AbortSignal): Promise<RuntimeCall<GeneratePreviewResult>>
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

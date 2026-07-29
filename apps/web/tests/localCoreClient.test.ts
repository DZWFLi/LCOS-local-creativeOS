import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  createLocalCoreClient,
  loadStructuredTestReport,
  LOCAL_CORE_API_PREFIX,
} from '../src/runtime/localCoreClient'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('Local Core browser client', () => {
  it('uses the versioned same-origin development prefix', () => {
    expect(LOCAL_CORE_API_PREFIX).toBe('/api/local-core/v1')
  })

  it('returns a runtime-origin health result with latency', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({
      status: 'ok',
      service: 'local-core',
      mode: 'read_only_phase_1a',
      version: '0.1.0',
    }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await createLocalCoreClient().health()

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/local-core/v1/health',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
    expect(result).toMatchObject({
      origin: 'runtime',
      result: { ok: true, value: { service: 'local-core', version: '0.1.0' } },
    })
    expect(result.latencyMs).toBeGreaterThanOrEqual(0)
  })

  it('maps an offline fetch to stable UNAVAILABLE without fixture fallback', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('connection refused')
    }))

    const result = await createLocalCoreClient().catalog()

    expect(result).toMatchObject({
      origin: 'runtime',
      result: {
        ok: false,
        error: {
          code: 'UNAVAILABLE',
          origin: 'runtime',
          retryable: true,
        },
      },
    })
  })

  it('preserves a stable Local Core validation error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({
      ok: false,
      error: {
        code: 'PROJECT_ROOT_NOT_FOUND',
        message: 'Project root does not exist.',
        retryable: false,
        origin: 'runtime',
      },
    }, 404)))

    const result = await createLocalCoreClient().validateProjectRoot('E:\\missing')

    expect(result.result).toMatchObject({
      ok: false,
      error: { code: 'PROJECT_ROOT_NOT_FOUND', origin: 'runtime' },
    })
  })

  it('treats an explicitly aborted request as ABORTED', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_input: unknown, init?: RequestInit) => {
      if (init?.signal?.aborted) throw new DOMException('aborted', 'AbortError')
      return await new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
      })
    }))
    const controller = new AbortController()
    const request = createLocalCoreClient().health(controller.signal)
    controller.abort()

    await expect(request).resolves.toMatchObject({
      origin: 'runtime',
      result: { ok: false, error: { code: 'ABORTED' } },
    })
  })

  it('reads a generated structured test report without executing tests', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({
      success: true,
      numTotalTests: 106,
      numPassedTests: 106,
      numFailedTests: 0,
    })))

    await expect(loadStructuredTestReport()).resolves.toEqual({
      ok: true,
      value: {
        success: true,
        numTotalTests: 106,
        numPassedTests: 106,
        numFailedTests: 0,
      },
    })
  })

  it('reads preview records through a read-only project route', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({
      ok: true,
      value: [{
        id: 'preview-1',
        projectId: 'project-1',
        revisionId: 'revision-1',
        sourceContentHash: 'hash-1',
        rendererId: 'markdown-preview',
        rendererVersion: '0.1.0',
        previewProfile: 'card',
        cacheKey: 'preview:key',
        cachePath: 'cache/preview.html',
        mimeType: 'text/html',
        size: 42,
        status: 'ready',
        createdAt: '2026-07-28T00:00:00.000Z',
        updatedAt: '2026-07-28T00:00:00.000Z',
      }],
    }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await createLocalCoreClient().previewRecords('project-1')

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/local-core/v1/projects/project-1/preview-records',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
    expect(result.result).toMatchObject({
      ok: true,
      value: [{ id: 'preview-1', status: 'ready' }],
    })
  })

  it('requests preview generation with revision id and profile only', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({
      ok: true,
      value: {
        reused: false,
        record: {
          id: 'preview-1',
          projectId: 'project-1',
          revisionId: 'revision-1',
          sourceContentHash: 'hash-1',
          rendererId: 'markdown',
          rendererVersion: '1',
          previewProfile: 'thumbnail',
          cacheKey: 'key',
          cachePath: 'cache/file.preview',
          mimeType: 'text/plain',
          size: 10,
          status: 'ready',
          createdAt: '2026-07-28T00:00:00.000Z',
          updatedAt: '2026-07-28T00:00:00.000Z',
        },
      },
    }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await createLocalCoreClient().generatePreview('project-1', 'revision-1', 'thumbnail')

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/local-core/v1/projects/project-1/previews',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ revisionId: 'revision-1', previewProfile: 'thumbnail' }),
      }),
    )
    expect(result.result).toMatchObject({ ok: true, value: { reused: false, record: { status: 'ready' } } })
  })

  it('registers Runtime Sources through opaque selection ids only', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({
      ok: true,
      value: {
        fileRecord: {
          id: 'file-1',
          projectId: 'project-1',
          observedPath: 'E:\\Projects\\Sample\\brief.md',
          observedHash: 'hash-1',
          size: 128,
          modifiedAt: '2026-07-28T00:00:00.000Z',
          mimeType: 'text/markdown',
          availability: 'current',
          observedAt: '2026-07-28T00:00:00.000Z',
        },
        artifact: {
          id: 'artifact-1',
          projectId: 'project-1',
          title: 'Brief',
          kind: 'markdown',
          availability: 'available',
          currentRevisionId: 'revision-1',
          createdAt: '2026-07-28T00:00:00.000Z',
          updatedAt: '2026-07-28T00:00:00.000Z',
        },
        revision: {
          id: 'revision-1',
          artifactId: 'artifact-1',
          fileRecordId: 'file-1',
          contentHash: 'hash-1',
          source: 'import',
          status: 'current',
          createdAt: '2026-07-28T00:00:00.000Z',
        },
      },
    }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await createLocalCoreClient().registerTrustedSource('project-1', {
      selectionId: 'opaque-selection' as never,
      title: 'Brief',
    })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/local-core/v1/projects/project-1/sources',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ selectionId: 'opaque-selection', title: 'Brief' }),
      }),
    )
    const calls = fetchMock.mock.calls as unknown as [string, RequestInit][]
    expect(JSON.parse(String(calls[0][1].body))).not.toHaveProperty('path')
    expect(result.result).toMatchObject({
      ok: true,
      value: { fileRecord: { id: 'file-1' }, artifact: { id: 'artifact-1' }, revision: { id: 'revision-1' } },
    })
  })
})

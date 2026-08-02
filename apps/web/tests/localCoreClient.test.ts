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

  it('imports dropped files through multipart Import Copy without browser paths', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({
      ok: true,
      value: {
        reused: false,
        fileRecord: { id: 'file-1', observedPath: 'E:\\Project\\imports\\brief.md' },
        artifact: { id: 'artifact-1', title: 'brief.md' },
        revision: { id: 'revision-1' },
        view: { id: 'view-1' },
      },
    }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await createLocalCoreClient().importCopy('project-1', {
      file: new File(['# Brief'], 'brief.md', { type: 'text/markdown' }),
      importRequestId: 'drop-1',
      scopeId: 'scope-root',
      x: 10,
      y: 20,
    })

    const calls = fetchMock.mock.calls as unknown as [string, RequestInit][]
    const [, init] = calls[0]
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/local-core/v1/projects/project-1/imports',
      expect.objectContaining({ method: 'POST', body: expect.any(FormData) }),
    )
    const body = init.body as FormData
    expect(body.get('importRequestId')).toBe('drop-1')
    expect(body.get('scopeId')).toBe('scope-root')
    expect(body.get('position.x')).toBe('10')
    expect(body.get('absolutePath')).toBeNull()
    expect(result.result).toMatchObject({ ok: true, value: { view: { id: 'view-1' } } })
  })

  it('uses canonical Runtime Review routes without translating provider status into UI state', async () => {
    const fetchMock = vi.fn(async (path: string, _init?: RequestInit) => jsonResponse({
      ok: true,
      value: path.endsWith('/review')
        ? { presentationPhase: 'review', returns: [], draftRevisions: [] }
        : { artifactReturn: { id: 'return-1' }, run: { id: 'run-1' } },
    }))
    vi.stubGlobal('fetch', fetchMock)
    const client = createLocalCoreClient()

    await client.getRunReview('run/1')
    await client.acceptArtifactReturn('return/1', { expectedBaseRevisionId: 'revision-1' as never })
    await client.rejectArtifactReturn('return/1')
    await client.retryArtifactReturn('return/1', { instruction: 'Keep the title.' })

    expect(fetchMock.mock.calls.map(([path]) => path)).toEqual([
      '/api/local-core/v1/runs/run%2F1/review',
      '/api/local-core/v1/artifact-returns/return%2F1/accept',
      '/api/local-core/v1/artifact-returns/return%2F1/reject',
      '/api/local-core/v1/artifact-returns/return%2F1/retry',
    ])
    expect(fetchMock.mock.calls[1]?.[1]).toEqual(expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ expectedBaseRevisionId: 'revision-1' }),
    }))
    expect(fetchMock.mock.calls[3]?.[1]).toEqual(expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ instruction: 'Keep the title.' }),
    }))
  })

  it('creates a real project through POST /projects with only name and rootPath', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({
      ok: true,
      value: {
        id: 'project-summer-3f2a9c1b',
        name: '夏季 Campaign',
        rootPath: 'E:\\Projects\\summer',
        graphVersion: 1,
      },
    }, 201))
    vi.stubGlobal('fetch', fetchMock)

    const result = await createLocalCoreClient().createProject({
      name: '夏季 Campaign',
      rootPath: 'E:\\Projects\\summer',
    })

    const calls = fetchMock.mock.calls as unknown as [string, RequestInit][]
    const [, init] = calls[0]
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/local-core/v1/projects',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: '夏季 Campaign', rootPath: 'E:\\Projects\\summer' }),
      }),
    )
    expect((init.headers as Headers).get('content-type')).toBe('application/json')
    expect(result).toMatchObject({
      origin: 'runtime',
      result: {
        ok: true,
        value: { id: 'project-summer-3f2a9c1b', graphVersion: 1 },
      },
    })
  })

  it('imports a directory through a raw-byte upload session', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ ok: true, value: { sessionId: 'upload-1' } }, 201))
      .mockResolvedValueOnce(jsonResponse({ ok: true, value: null }))
      .mockResolvedValueOnce(jsonResponse({ ok: true, value: { resourceId: 'resource-dir', sourceKind: 'directory_copy', understandingStatus: 'pending' } }, 201))
    vi.stubGlobal('fetch', fetchMock)

    const result = await createLocalCoreClient().importResourceDirectory('project-1', {
      importRequestId: 'dir-1',
      rootName: 'my-skill',
      files: [{ path: 'my-skill/SKILL.md', file: new File(['# Skill'], 'SKILL.md', { type: 'text/markdown' }) }],
      scopeId: 'scope-root',
      x: 10,
      y: 20,
    })

    const calls = fetchMock.mock.calls as unknown as [string, RequestInit][]
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/local-core/v1/projects/project-1/resource-upload-sessions',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/local-core/v1/projects/project-1/resource-upload-sessions/upload-1/files?path=my-skill%2FSKILL.md',
      expect.objectContaining({ method: 'PUT', body: expect.any(File) }),
    )
    const [, init] = calls[0]!
    const body = JSON.parse(String(init.body)) as Record<string, unknown>
    expect(body.purpose).toBeUndefined()
    expect(body.description).toBeUndefined()
    expect(body.files).toBeUndefined()
    expect(result.result).toMatchObject({ ok: true, value: { sourceKind: 'directory_copy' } })
  })

  it('imports a ZIP archive as multipart', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({
      ok: true,
      value: { resourceId: 'resource-zip', sourceKind: 'archive_copy', understandingStatus: 'pending' },
    }, 201))
    vi.stubGlobal('fetch', fetchMock)

    const file = new File([new Uint8Array([80, 75, 5, 6])], 'pkg.zip', { type: 'application/zip' })
    await createLocalCoreClient().importResourceArchive('project-1', {
      file,
      importRequestId: 'zip-1',
      scopeId: 'scope-root',
      x: 0,
      y: 0,
    })

    const calls = fetchMock.mock.calls as unknown as [string, RequestInit][]
    const [, init] = calls[0]
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/local-core/v1/projects/project-1/resources/import-archive',
      expect.objectContaining({ method: 'POST' }),
    )
    const form = init.body as FormData
    expect(form.get('file')).toBe(file)
    expect(form.get('importRequestId')).toBe('zip-1')
  })
})

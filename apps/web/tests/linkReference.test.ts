import { afterEach, describe, expect, it, vi } from 'vitest'

import { createLocalCoreClient } from '../src/runtime/localCoreClient'

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

describe('Link Reference zero-form import', () => {
  it('posts only url, optional title/note and placement to import-url', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({
      ok: true,
      value: {
        resourceId: 'resource-abc',
        artifactId: 'import-artifact-abc',
        revisionId: 'import-revision-abc',
        viewId: 'import-view-abc',
        sourceKind: 'link',
        understandingStatus: 'pending',
      },
    }, 201))
    vi.stubGlobal('fetch', fetchMock)

    const result = await createLocalCoreClient().importResourceUrl('project-1', {
      url: 'https://example.com/script',
      scopeId: 'scope-root',
      x: 10,
      y: 20,
    })

    const calls = fetchMock.mock.calls as unknown as [string, RequestInit][]
    const [, init] = calls[0]
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/local-core/v1/projects/project-1/resources/import-url',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(JSON.parse(String(init.body))).toEqual({
      url: 'https://example.com/script',
      scopeId: 'scope-root',
      x: 10,
      y: 20,
    })
    expect(result.result).toMatchObject({
      ok: true,
      value: { sourceKind: 'link', understandingStatus: 'pending' },
    })
  })

  it('does not require purpose, description, category or workflowStage', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ ok: true, value: { resourceId: 'r' } }, 201))
    vi.stubGlobal('fetch', fetchMock)

    await createLocalCoreClient().importResourceUrl('project-1', {
      url: 'https://feishu.cn/wiki/abc',
      scopeId: 'scope-root',
      x: 0,
      y: 0,
    })

    const calls = fetchMock.mock.calls as unknown as [string, RequestInit][]
    const body = JSON.parse(String(calls[0]?.[1]?.body)) as Record<string, unknown>
    expect(body.purpose).toBeUndefined()
    expect(body.description).toBeUndefined()
    expect(body.category).toBeUndefined()
    expect(body.workflowStage).toBeUndefined()
  })
})

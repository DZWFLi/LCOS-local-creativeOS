import { describe, expect, it } from 'vitest'
import { createFixtureFrontendAdapter, fixtureProjectId } from '../src/adapters/fixtureAdapter'

describe('frontend adapter boundary', () => {
  it('serves WorkspaceQuery from an explicit fixture origin', async () => {
    const adapter = createFixtureFrontendAdapter()
    const result = await adapter.workspace.getWorkspaces({ projectId: fixtureProjectId, includeViewport: true })
    expect(adapter.origin).toBe('fixture')
    expect(result.ok && result.value).toHaveLength(4)
  })

  it('keeps Preview and Runtime results explicit about fixture limits', async () => {
    const adapter = createFixtureFrontendAdapter()
    const preview = await adapter.preview.getPreview('artifact-1' as never, 'thumbnail')
    const retry = await adapter.runtime.retryRun('run-1' as never)
    expect(preview.ok && preview.value.origin).toBe('fixture')
    expect(retry.ok).toBe(false)
    if (!retry.ok) expect(retry.error.origin).toBe('fixture')
  })
})

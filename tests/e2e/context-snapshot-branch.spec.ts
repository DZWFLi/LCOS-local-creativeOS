import { expect, test } from '@playwright/test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createMvpSampleSnapshot } from '../../apps/local-core/src/mvp-sample-project'
import { createLocalCoreHarness } from './local-core-harness'

const SEED_PROJECT_URL = '/?project=disposable-mvp-sample'
const harness = createLocalCoreHarness()

test.beforeAll(async () => { await harness.start() })
test.afterAll(async () => { await harness.stop() })

async function seedContextGraph(request: import('@playwright/test').APIRequestContext) {
  const sampleRoot = mkdtempSync(join(tmpdir(), 'lcos-s3-context-'))
  try {
    const snapshot = createMvpSampleSnapshot(sampleRoot)
    const now = new Date().toISOString()
    snapshot.scopes.push({
      id: 'scope-s3-context' as never,
      projectId: snapshot.project.id,
      parentScopeId: 'scope-mvp-root' as never,
      containerViewId: null,
      kind: 'context',
      name: 'S3 Context',
      createdAt: now,
      updatedAt: now,
    } as never)
    const seeded = await request.put('/api/local-core/v1/projects/disposable-mvp-sample/graph', { data: { snapshot } })
    expect(seeded.ok()).toBe(true)
  } finally {
    rmSync(sampleRoot, { recursive: true, force: true })
  }
}

test('Context History branch uses Core branch and survives reload without touching the snapshot', async ({ page }) => {
  await seedContextGraph(page.request)
  const snap = await page.request.post('/api/local-core/v1/projects/disposable-mvp-sample/context-snapshots', {
    data: { label: 'S3 快照', workspaceId: 'workspace-brief-script' },
  })
  expect(snap.ok()).toBe(true)
  const snapshotId = (await snap.json() as { value: { id: string } }).value.id

  await page.goto(SEED_PROJECT_URL)
  await expect(page.getByTestId('canvas')).toBeVisible()
  await page.getByTestId('vnext-bottom-dock').getByRole('button', { name: '上下文', exact: false }).click()
  await expect(page.getByTestId('surface-context-space')).toBeVisible()
  await page.getByRole('button', { name: '结构', exact: true }).click()
  await expect(page.locator('[data-testid="surface-context-tree"]')).toBeVisible()

  await page.getByRole('button', { name: '打开 S3 快照' }).click()
  await page.getByRole('button', { name: '从这里分支' }).click()
  await expect(page.locator('[data-surface-mount="arrange"]')).toBeVisible()
  await expect(page.getByTestId('toast')).toContainText('分支为工作集合')
  expect(await page.locator('[data-node-id]').count()).toBeGreaterThanOrEqual(2)

  // Core truth：快照不变 + 原视图仍在原 scope + 新 collection 出现复制视图
  const graphAfter = await (await page.request.get('/api/local-core/v1/projects/disposable-mvp-sample/graph')).json() as {
    value: { scopes: readonly { id: string; kind: string; name: string }[]; artifactViews: readonly { id: string; scopeId: string }[] }
  }
  const collection = graphAfter.value.scopes.find((scope) => scope.name === '从 S3 快照 恢复')
  expect(collection?.kind).toBe('collection')
  expect(graphAfter.value.artifactViews.some((view) => view.id === 'view-brief' && view.scopeId === 'scope-mvp-root')).toBe(true)
  expect(graphAfter.value.artifactViews.filter((view) => view.scopeId === collection?.id).length).toBeGreaterThanOrEqual(2)
  const snapshotsAfter = await (await page.request.get('/api/local-core/v1/projects/disposable-mvp-sample/context-snapshots')).json() as { value: readonly { id: string }[] }
  expect(snapshotsAfter.value.some((item) => item.id === snapshotId)).toBe(true)

  // reload 后分支仍可见（Project rail 出现该 collection 视图）
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('workspace-dock')).toBeVisible()
  await expect(page.getByTestId('workspace-dock').getByRole('listitem', { name: /从 S3 快照 恢复/ })).toBeVisible()
})

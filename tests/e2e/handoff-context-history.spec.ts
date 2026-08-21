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

async function openContext(page: import('@playwright/test').Page) {
  await page.goto(SEED_PROJECT_URL)
  await expect(page.getByTestId('canvas')).toBeVisible()
  await page.getByTestId('vnext-bottom-dock').getByRole('button', { name: '上下文', exact: false }).click()
  await expect(page.locator('[data-surface-mount="context-graph"]')).toBeVisible()
}

test('no empty handoff shell when the project has no handoffs', async ({ page }) => {
  await openContext(page)
  await expect(page.locator('.lcos-handoff-mini-list')).toHaveCount(0)
})

test('a Core handoff shows in Context History and survives reload', async ({ page }) => {
  // 先给 Core 种一个真实 Context（graph 替换），再用 API 写入真实 Handoff。
  const sampleRoot = mkdtempSync(join(tmpdir(), 'lcos-s2-context-'))
  try {
    const snapshot = createMvpSampleSnapshot(sampleRoot)
    const now = new Date().toISOString()
    snapshot.scopes.push({
      id: 'scope-s2-context' as never,
      projectId: snapshot.project.id,
      parentScopeId: 'scope-mvp-root' as never,
      containerViewId: null,
      kind: 'context',
      name: 'S2 Context',
      createdAt: now,
      updatedAt: now,
    } as never)
    const seeded = await page.request.put('/api/local-core/v1/projects/disposable-mvp-sample/graph', { data: { snapshot } })
    expect(seeded.ok()).toBe(true)
  } finally {
    rmSync(sampleRoot, { recursive: true, force: true })
  }

  const created = await page.request.post('/api/local-core/v1/projects/disposable-mvp-sample/handoffs', {
    data: {
      title: 'S2 真机验证交接',
      decisions: ['保留现有结构'],
      openQuestions: ['是否进入修订'],
      artifactRefs: [{ artifactId: 'artifact-script' }],
    },
  })
  expect(created.ok()).toBe(true)

  // 进入 Context 详情（思维导图投影渲染 ContextHistoryRail），验证 Handoff 可见。
  await page.goto(SEED_PROJECT_URL)
  await expect(page.getByTestId('canvas')).toBeVisible()
  await page.getByTestId('vnext-bottom-dock').getByRole('button', { name: '上下文', exact: false }).click()
  await expect(page.locator('[data-surface-mount="context-graph"]')).toBeVisible()
  const dot = page.locator('[data-context-view]').first()
  await expect(dot).toBeVisible()
  await dot.dblclick()
  await expect(page.locator('[data-surface-mount="context-flow"]')).toBeVisible()
  await page.getByTestId('vnext-bottom-dock').getByRole('button', { name: '思维导图', exact: false }).click()
  await expect(page.locator('[data-testid="surface-context-tree"]')).toBeVisible()
  const mini = page.locator('.lcos-handoff-mini-list')
  await expect(mini).toBeVisible()
  await expect(mini).toContainText('S2 真机验证交接')
  await expect(mini).toContainText('1 决定')
  await expect(mini).toContainText('1 未决')
  await expect(mini).toContainText('1 产物')

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByTestId('vnext-bottom-dock').getByRole('button', { name: '上下文', exact: false }).click()
  await expect(page.locator('[data-surface-mount="context-graph"]')).toBeVisible()
  const dot2 = page.locator('[data-context-view]').first()
  await dot2.dblclick()
  await expect(page.locator('[data-surface-mount="context-flow"]')).toBeVisible()
  await page.getByTestId('vnext-bottom-dock').getByRole('button', { name: '思维导图', exact: false }).click()
  await expect(page.locator('[data-testid="surface-context-tree"]')).toBeVisible()
  await expect(page.locator('.lcos-handoff-mini-list')).toContainText('S2 真机验证交接')
})

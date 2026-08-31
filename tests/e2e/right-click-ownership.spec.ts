import { expect, test, type Page } from '@playwright/test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createMvpSampleSnapshot } from '../../apps/local-core/src/mvp-sample-project'
import { createLocalCoreHarness } from './local-core-harness'

let sampleRoot = ''
let projectId = ''
const harness = createLocalCoreHarness()

test.beforeAll(async () => { await harness.start(); sampleRoot = mkdtempSync(path.join(tmpdir(), 'lcos-right-click-e2e-')) })
test.afterAll(async () => { if (sampleRoot) rmSync(sampleRoot, { recursive: true, force: true }); await harness.stop() })

test.beforeEach(async ({ request }) => {
  projectId = `right-click-e2e-${Date.now()}`
  const seed = createMvpSampleSnapshot(sampleRoot)
  seed.workspaces[0] = { ...seed.workspaces[0]!, focusedViewIds: seed.artifactViews.map((view) => view.id) }
  const ids = [...seed.scopes, ...seed.workspaces, ...seed.artifacts, ...seed.artifactViews, ...seed.relations, ...seed.notes, ...seed.artifactRevisions, ...seed.fileRecords, ...seed.checkpoints].map((item) => String(item.id))
  let serialized = JSON.stringify(seed).split(String(seed.project.id)).join(projectId)
  for (const id of ids.sort((a, b) => b.length - a.length)) serialized = serialized.split(id).join(`${projectId}--${id}`)
  const snapshot = JSON.parse(serialized) as typeof seed
  const response = await request.put(`/api/local-core/v1/projects/${projectId}/graph`, { data: { snapshot } })
  expect(response.ok(), await response.text()).toBe(true)
})

test.afterEach(async ({ request }) => { if (projectId) await request.delete(`/api/local-core/v1/projects/${projectId}`) })

async function openProject(page: Page) {
  await page.goto(`/?project=${projectId}`)
  await expect(page.getByTestId('canvas')).toBeVisible()
  const close = page.getByRole('button', { name: '关闭提示' })
  if (await close.count()) await close.click().catch(() => undefined)
  await page.waitForTimeout(700)
}

async function expectObjectMenu(page: Page) {
  const menu = page.locator('[data-context-menu-scope="对象"]')
  await expect(menu).toBeVisible({ timeout: 3000 })
  await expect(menu.locator('[data-context-menu-action="focus"]')).toHaveCount(0)
  await expect(menu.locator('[data-context-menu-action="pin"], [data-context-menu-action="unpin"]')).toHaveCount(0)
  await expect(menu.locator('[data-context-menu-action="relation"]')).toHaveCount(0)
  await expect(menu.locator('[data-context-menu-action="assembly"]')).toHaveCount(0)
  await expect(menu.locator('[data-context-menu-action="copy"], [data-context-menu-action="add-reference"], [data-context-menu-action="remove-reference"], [data-context-menu-action="duplicate-view"], [data-context-menu-action="remove-projection"]')).not.toHaveCount(0)
}

test('simple right-click opens management menu while right-drag remains Semantic Drop', async ({ page }) => {
  await openProject(page)
  const object = page.locator('[data-testid^="canvas-node-"][data-artifact-id]:not([data-entity-kind="conversation"])').first()
  await expect(object).toBeVisible({ timeout: 15_000 })
  await object.click({ button: 'right' })
  await expectObjectMenu(page)
  await expect(page.locator('.lcos-semantic-drop-ghost')).toHaveCount(0)
  await page.keyboard.press('Escape')

  const box = await object.boundingBox()
  if (!box) throw new Error('object has no bounds')
  const x = box.x + box.width * .5
  const y = box.y + box.height * .5
  await page.mouse.move(x, y)
  await page.mouse.down({ button: 'right' })
  await page.mouse.move(x + 40, y + 24, { steps: 4 })
  await expect(page.locator('.lcos-semantic-drop-ghost')).toBeVisible({ timeout: 2000 })
  await page.mouse.up({ button: 'right' })
  await page.waitForTimeout(350)
  await expect(page.locator('[data-context-menu-scope="对象"]')).toHaveCount(0)
})

test('Context and Workflow project materials use the same object management owner', async ({ page }) => {
  await openProject(page)
  const dock = page.getByTestId('vnext-bottom-dock')

  await dock.getByRole('button', { name: '上下文', exact: false }).click()
  await expect(page.getByTestId('surface-context-space')).toBeVisible()
  const contextObject = page.locator('[data-surface="context-space"] [data-node-id], [data-testid="surface-context-space"] [data-node-id]').first()
  await expect(contextObject).toBeVisible({ timeout: 10_000 })
  await contextObject.click({ button: 'right' })
  await expectObjectMenu(page)
  await page.keyboard.press('Escape')

  await dock.getByRole('button', { name: '工作流', exact: false }).click()
  const workflowObject = page.locator('[data-surface="workflow"] [data-node-id]').first()
  await expect(workflowObject).toBeVisible({ timeout: 10_000 })
  await workflowObject.click({ button: 'right' })
  await expectObjectMenu(page)
})

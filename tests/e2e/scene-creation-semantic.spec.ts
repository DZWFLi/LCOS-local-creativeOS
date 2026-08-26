import { expect, test } from '@playwright/test'
import { createLocalCoreHarness } from './local-core-harness'

const PROJECT_URL = '/?project=disposable-mvp-sample'
const harness = createLocalCoreHarness()

test.beforeAll(async () => { await harness.start() })
test.afterAll(async () => { await harness.stop() })

test('Workspace + creates and persists an empty Current Scene without seeding Selection', async ({ page }) => {
  await page.goto(PROJECT_URL)
  const canvas = page.getByTestId('canvas')
  await expect(canvas).toBeVisible()
  await page.getByTestId('workspace-dock').getByRole('button', { name: '主画布' }).click()
  await page.waitForFunction(() => document.querySelectorAll('[data-node-id]').length >= 4, undefined, { timeout: 15000 })
  await page.waitForFunction(() => !document.querySelector('[data-testid="canvas"]')?.hasAttribute('data-locked'), undefined, { timeout: 15000 })
  await page.getByRole('button', { name: '定位内容' }).click()
  await page.waitForTimeout(500)

  const overviewCount = await page.locator('[data-node-id]').count()
  const overviewCamera = {
    x: await canvas.getAttribute('data-camera-x'),
    y: await canvas.getAttribute('data-camera-y'),
    zoom: await canvas.getAttribute('data-camera-zoom'),
  }
  const visibleNodeCenters = await page.locator('[data-node-id]').evaluateAll((elements) => elements.flatMap((element) => {
    const rect = element.getBoundingClientRect()
    return rect.width > 0 && rect.height > 0 && rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight
      ? [{ id: element.getAttribute('data-node-id') ?? '', x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }]
      : []
  }).slice(0, 1))
  expect(visibleNodeCenters).toHaveLength(1)
  await page.locator(`[data-node-id="${visibleNodeCenters[0]!.id}"]`).click({ force: true })
  await canvas.press('Control+a')
  expect(await page.locator('[data-node-id].selected').count()).toBeGreaterThan(0)

  const railItems = page.getByTestId('workspace-dock').getByRole('listitem')
  const before = await railItems.count()
  await page.getByRole('button', { name: '新建保存视图' }).click()

  await expect(page.getByRole('dialog', { name: /保存一个工作现场|Workspace/i })).toHaveCount(0)
  await expect(railItems).toHaveCount(before + 1)
  // Scene creation leaves the user on the root canvas with a real Scene entity;
  // entering the Scene is an explicit second action.
  const createdScene = railItems.last()
  await expect(createdScene).toBeVisible()
  const sceneLabel = (await createdScene.getAttribute('aria-label'))?.replace(/^进入[^：]+：/, '')
  expect(sceneLabel).toBeTruthy()
  await expect(page.locator('[data-surface-mount="arrange"]')).toBeVisible()
  await expect(page.locator('[data-node-id]')).toHaveCount(overviewCount + 1)
  await expect(canvas).toHaveAttribute('data-camera-x', overviewCamera.x ?? '')
  await expect(canvas).toHaveAttribute('data-camera-y', overviewCamera.y ?? '')
  await expect(canvas).toHaveAttribute('data-camera-zoom', overviewCamera.zoom ?? '')

  await createdScene.click()
  await expect(page.getByTestId('workspace-dock').locator('button[role="listitem"].active')).toBeVisible()
  await expect(page.locator('[data-node-id]')).toHaveCount(0)

  // 等待 debounce 保存真正落到 Local Core，再 reload；避免把保存时序误判成数据丢失
  await expect.poll(async () => {
    const response = await page.request.get('/api/local-core/v1/projects/disposable-mvp-sample/graph')
    const body = await response.json() as { value?: { workspaces?: readonly { name: string }[] } }
    return body.value?.workspaces?.some((workspace) => workspace.name === sceneLabel) ?? false
  }, { timeout: 10000 }).toBe(true)

  await page.reload()
  await expect(page.getByTestId('workspace-dock')).toBeVisible()
  const persistedScene = page.getByTestId('workspace-dock').getByRole('listitem', { name: new RegExp(`${sceneLabel}$`) })
  await expect(persistedScene).toBeVisible()
  await persistedScene.click()
  await expect(page.locator('[data-node-id]')).toHaveCount(0)
  await expect(canvas).toHaveAttribute('data-camera-x', overviewCamera.x ?? '')
  await expect(canvas).toHaveAttribute('data-camera-y', overviewCamera.y ?? '')
  await expect(canvas).toHaveAttribute('data-camera-zoom', overviewCamera.zoom ?? '')
})

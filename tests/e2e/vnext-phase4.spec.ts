import { expect, test } from '@playwright/test'
import { createLocalCoreHarness } from './local-core-harness'

const SEED_PROJECT_URL = '/?project=disposable-mvp-sample'
const harness = createLocalCoreHarness()

test.beforeAll(async () => { await harness.start() })
test.afterAll(async () => { await harness.stop() })

/** 等 seed 画布真实渲染出至少两个节点，避免加载时序导致的假跳过。 */
async function waitForSeedNodes(page: import('@playwright/test').Page) {
  await page.goto(SEED_PROJECT_URL)
  await expect(page.getByTestId('canvas')).toBeVisible()
  await page.waitForFunction(() => document.querySelectorAll('[data-node-id]').length >= 2, undefined, { timeout: 15000 })
  // 画布加载完成前 locked=true，节点点击无效；等解锁后再交互
  await page.waitForFunction(() => {
    const canvas = document.querySelector('[data-testid="canvas"]')
    return Boolean(canvas && !canvas.hasAttribute('data-locked'))
  }, undefined, { timeout: 15000 })
  // 等初始相机/布局稳定，避免拖拽起点漂移导致 pointerdown 落空
  await page.waitForTimeout(600)
}

test.describe('LCOS vNext Phase 4', () => {
  const dockButton = (page: import('@playwright/test').Page, name: string) =>
    // VNext3 capability 按钮带副标题（如「上下文：对话与上下文视图」），用子串匹配。
    page.getByTestId('vnext-bottom-dock').getByRole('button', { name, exact: false })

  test('shell keeps project context while surfaces switch independently', async ({ page }) => {
    await page.goto(SEED_PROJECT_URL)
    await expect(page.getByTestId('vnext-bottom-dock')).toBeVisible()
    await dockButton(page, '上下文').click()
    await expect(page.locator('[data-surface-mount="context-graph"]')).toBeVisible()
    await dockButton(page, '工作流').click()
    await expect(page.locator('[data-testid="surface-workflow-graph"]')).toBeVisible()
    await dockButton(page, '整理').click()
    await expect(page.locator('[data-surface-mount="arrange"]')).toBeVisible()
  })

  test('bottom-gutter staging is retired; dock capabilities are the semantic drop targets', async ({ page }) => {
    await waitForSeedNodes(page)
    const nodes = page.locator('[data-node-id]')
    await expect(nodes.first()).toBeVisible()
    expect(await nodes.count()).toBeGreaterThanOrEqual(2)
    await nodes.nth(0).click()
    await nodes.nth(1).click({ modifiers: ['Control'] })
    await expect(page.getByTestId('selection-bounds')).toBeVisible()
    // 收敛契约：底部停留带 staging（.drop-edge-cue / DropShelf）已退役，无 DOM；
    // 语义投送目标是 dock 的「上下文 / 工作流」能力按钮
    await expect(page.locator('.drop-edge-cue')).toHaveCount(0)
    await expect(page.getByTestId('drop-shelf')).toHaveCount(0)
    await expect(dockButton(page, '上下文')).toHaveAttribute('data-project-view-drop-target', 'capability:context')
    await expect(dockButton(page, '工作流')).toHaveAttribute('data-project-view-drop-target', 'capability:workflow')
  })

  test('context projections stay inside a Context and relation editing stays on the canvas', async ({ page }) => {
    await waitForSeedNodes(page)
    // 收敛契约：上下文入口是 Context Graph；大纲/思维导图是进入具体 Context 后的投影，
    // 不再作为 bottom dock 常驻按钮
    await dockButton(page, '上下文').click()
    await expect(page.locator('[data-surface-mount="context-graph"]')).toBeVisible()
    await expect(dockButton(page, '大纲')).toHaveCount(0)
    await dockButton(page, '整理').click()
    await expect(page.locator('[data-surface-mount="arrange"]')).toBeVisible()
    const edge = page.locator('.edge-hit').first()
    test.skip(await edge.count() === 0, 'Seed project needs at least one relation')
    await edge.click({ force: true })
    await expect(page.locator('[data-testid^="edge-controls-"]')).toBeVisible()
    await expect(page.locator('[data-testid^="edge-cut-"]')).toBeVisible()
  })
})

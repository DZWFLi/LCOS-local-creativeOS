import { expect, test } from '@playwright/test'

const SEED_PROJECT_URL = '/?project=disposable-mvp-sample'

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
    page.getByTestId('vnext-bottom-dock').getByRole('button', { name, exact: true })

  test('shell keeps project context while surfaces switch independently', async ({ page }) => {
    await page.goto(SEED_PROJECT_URL)
    await expect(page.getByTestId('vnext-bottom-dock')).toBeVisible()
    await dockButton(page, '上下文').click()
    await expect(page.locator('[data-surface-mount="context-flow"]')).toBeVisible()
    await dockButton(page, '运行').click()
    await expect(page.locator('[data-surface-mount="work"]')).toBeVisible()
    await dockButton(page, '整理').click()
    await expect(page.locator('[data-surface-mount="arrange"]')).toBeVisible()
  })

  test('multi-selection can stage from bottom gutter without treating Lens as destination', async ({ page }) => {
    await waitForSeedNodes(page)
    const nodes = page.locator('[data-node-id]')
    await expect(nodes.first()).toBeVisible()
    expect(await nodes.count()).toBeGreaterThanOrEqual(2)
    await nodes.nth(0).click()
    await nodes.nth(1).click({ modifiers: ['Control'] })
    await expect(page.getByTestId('selection-bounds')).toBeVisible()
    // 等选中态渲染/布局稳定，避免 boundingBox 与真实位置漂移
    await page.waitForTimeout(600)
    const box = await page.getByTestId('canvas').boundingBox()
    if (!box) throw new Error('Canvas bounds unavailable')
    const selectedBoxes = await page.locator('[data-node-id].selected').evaluateAll((els) => els.map((el) => {
      const r = el.getBoundingClientRect()
      return { x: r.x, y: r.y, w: r.width, h: r.height }
    }))
    // 拖最下方的已选节点作为拖拽起点（nearfield composer 已与首次单击脱钩，
    // 不再遮挡；selection toolbar 的包围盒与实际命中区域不一致，不做几何避让）
    const pick = selectedBoxes.reduce((a, b) => (b.y > a.y ? b : a))
    await page.mouse.move(pick.x + pick.w / 2, pick.y + pick.h / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2, box.y + box.height - 24, { steps: 8 })
    await expect(page.getByTestId('drop-gutter-bottom')).toHaveClass(/active/)
    await page.mouse.up()
    await expect(page.getByTestId('drop-shelf')).toBeVisible()
    await expect(dockButton(page, '上下文')).toBeVisible()
  })

  test('outline/context history/relation editing controls are present', async ({ page }) => {
    await waitForSeedNodes(page)
    await dockButton(page, '整理').click()
    await dockButton(page, '大纲').click()
    await expect(page.locator('.lcos-outline-sheet')).toBeVisible()
    await dockButton(page, '上下文').click()
    await expect(page.locator('.lcos-context-history')).toBeVisible()

    await dockButton(page, '整理').click()
    const edge = page.locator('.edge-hit').first()
    test.skip(await edge.count() === 0, 'Seed project needs at least one relation')
    await edge.click({ force: true })
    await expect(page.locator('[data-testid^="edge-controls-"]')).toBeVisible()
    await expect(page.locator('[data-testid^="edge-cut-"]')).toBeVisible()
  })
})

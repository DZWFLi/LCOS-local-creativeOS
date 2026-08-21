import { expect, test } from '@playwright/test'
import { createLocalCoreHarness } from './local-core-harness'

const harness = createLocalCoreHarness()

test.beforeAll(async () => { await harness.start() })
test.afterAll(async () => { await harness.stop() })

test('从选择沉淀上下文 persists the new Context into the Context Graph', async ({ page }) => {
  // Playwright profile 的 localStorage 会跨测试累积演示 Context，导致 context-view 绝对数不稳定。
  // 先清空持久化状态再测，保证断言的是本次新建的那一个。
  await page.goto('/?project=disposable-mvp-sample', { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => {
    const keys = Object.keys(window.localStorage)
    for (const key of keys) window.localStorage.removeItem(key)
  })
  await page.reload({ waitUntil: 'domcontentloaded' })
  const canvas = page.getByTestId('canvas')
  await expect(canvas).toBeVisible()
  const nodes = page.locator('[data-node-id]')
  // 节点从 Core 异步加载（boot runtime 模式），立即 count 会拿到 0；
  // 用 Playwright 自动重试断言等待至少 2 个节点渲染完成。
  await expect.poll(async () => nodes.count(), { timeout: 10_000, message: '等待画布节点从 Core 加载' }).toBeGreaterThanOrEqual(2)

  await nodes.nth(0).click({ force: true })
  await nodes.nth(1).click({ force: true, modifiers: ['Control'] })

  // The action lives in the surface blank-area menu, not the node's own menu.
  await canvas.click({ button: 'right', position: { x: 72, y: 72 } })
  const action = page.getByRole('button', { name: /从选择沉淀上下文/ })
  await expect(action).toBeEnabled()
  await action.click()

  await page.getByTestId('vnext-bottom-dock').getByRole('button', { name: '上下文', exact: false }).click()
  await expect(page.locator('[data-surface-mount="context-graph"]')).toBeVisible()
  // 至少 1 个：本次新建的 Context 必须出现（不依赖 localStorage 里历史演示数据）。
  await expect(page.locator('[data-context-view]').first()).toBeVisible({ timeout: 10_000 })

  // Persistence, not only optimistic UI: reload and the created Context must still exist.
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByTestId('vnext-bottom-dock').getByRole('button', { name: '上下文', exact: false }).click()
  await expect(page.locator('[data-surface-mount="context-graph"]')).toBeVisible()
  await expect(page.locator('[data-context-view]').first()).toBeVisible({ timeout: 10_000 })
})

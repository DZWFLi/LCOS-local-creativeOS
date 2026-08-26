import { expect, test } from '@playwright/test'
import { createLocalCoreHarness } from './local-core-harness'

const PROJECT_URL = '/?project=disposable-mvp-sample'
const harness = createLocalCoreHarness()

test.beforeAll(async () => { await harness.start() })
test.afterAll(async () => { await harness.stop() })

test('frozen Selection payload drops to Rail New Scene, persists, cancels cleanly, and creates independent Scenes', async ({ page }) => {
  test.setTimeout(60_000)
  await page.goto(PROJECT_URL)
  const canvas = page.getByTestId('canvas')
  const dock = page.getByTestId('workspace-dock')
  await expect(canvas).toBeVisible()
  await dock.getByRole('button', { name: '主画布' }).click()
  await page.waitForFunction(() => document.querySelectorAll('[data-node-id]').length >= 5, undefined, { timeout: 15000 })
  await page.waitForFunction(() => !document.querySelector('[data-testid="canvas"]')?.hasAttribute('data-locked'), undefined, { timeout: 15000 })
  await page.getByRole('button', { name: '定位内容' }).click()
  await page.waitForTimeout(400)

  const overviewIds = await page.locator('[data-node-id]').evaluateAll((elements) => elements.flatMap((element) => {
    const rect = element.getBoundingClientRect()
    return rect.width > 0 && rect.height > 0 && rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight
      ? [element.getAttribute('data-node-id') ?? '']
      : []
  }).filter(Boolean).slice(0, 5))
  expect(overviewIds).toHaveLength(5)
  const railItems = dock.getByRole('listitem')
  const target = page.getByTestId('new-scene-drop-target')

  const hitPoint = async (selector: string) => page.locator(selector).evaluate((element, ownSelector) => {
    const rect = element.getBoundingClientRect()
    for (const px of [.2, .5, .8]) for (const py of [.2, .5, .8]) {
      const x = rect.left + rect.width * px
      const y = rect.top + rect.height * py
      if (document.elementFromPoint(x, y)?.closest(ownSelector) === element) return { x, y }
    }
    return null
  }, selector)

  const select = async (ids: readonly string[]) => {
    for (const [index, id] of ids.entries()) {
      await page.locator(`[data-node-id="${id}"]`).evaluate((element, additive) => {
        const rect = element.getBoundingClientRect()
        const init = { bubbles: true, button: 0, buttons: 1, pointerId: 90 + Number(additive), clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2, ctrlKey: Boolean(additive) }
        element.dispatchEvent(new PointerEvent('pointerdown', init))
        element.dispatchEvent(new PointerEvent('pointerup', { ...init, buttons: 0 }))
      }, index)
    }
    await expect(page.locator('[data-node-id].selected')).toHaveCount(ids.length)
  }

  const semanticDrop = async (sourceId: string, mutateSelectionId?: string) => {
    const sourcePoint = await hitPoint(`[data-node-id="${sourceId}"]`)
    const targetPoint = await hitPoint('[data-testid="new-scene-drop-target"]')
    expect(sourcePoint).not.toBeNull()
    expect(targetPoint).not.toBeNull()
    await page.mouse.move(sourcePoint!.x, sourcePoint!.y)
    await page.mouse.down({ button: 'right' })
    await page.mouse.move(targetPoint!.x, targetPoint!.y, { steps: 12 })
    await expect(target).toHaveClass(/is-direct-drop-target/)
    if (mutateSelectionId) {
      await page.locator(`[data-node-id="${mutateSelectionId}"]`).evaluate((element) => {
        element.dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }))
      })
    }
    await page.mouse.up({ button: 'right' })
  }

  const beforeFirst = await railItems.count()
  const firstMembers = overviewIds.slice(0, 3)
  await select(firstMembers)
  await semanticDrop(firstMembers[0]!, overviewIds[3])
  await expect(railItems).toHaveCount(beforeFirst + 1)
  await expect(page.locator('[data-surface-mount="arrange"]')).toBeVisible()
  const sceneOneEntry = railItems.last()
  const sceneOneLabel = (await sceneOneEntry.getAttribute('aria-label'))?.replace(/^进入[^：]+：/, '') ?? ''
  expect(sceneOneLabel).not.toBe('')
  await sceneOneEntry.click()
  await expect(page.locator('[data-node-id]')).toHaveCount(3)
  expect((await page.locator('[data-node-id]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-node-id')).sort()))).toEqual([...firstMembers].sort())

  await dock.getByRole('button', { name: '主画布' }).click()
  for (const id of overviewIds.slice(3, 5)) await expect(page.locator(`[data-node-id="${id}"]`)).toBeVisible()
  await page.getByRole('button', { name: '定位内容' }).click()
  await page.waitForTimeout(300)

  const beforeCancel = await railItems.count()
  await select(overviewIds.slice(3, 5))
  const cancelSource = await hitPoint(`[data-node-id="${overviewIds[3]}"]`)
  const cancelTarget = await hitPoint('[data-testid="new-scene-drop-target"]')
  await page.mouse.move(cancelSource!.x, cancelSource!.y)
  await page.mouse.down({ button: 'right' })
  await page.mouse.move(cancelTarget!.x, cancelTarget!.y, { steps: 8 })
  await expect(target).toHaveClass(/is-direct-drop-target/)
  await page.keyboard.press('Escape')
  await page.mouse.up({ button: 'right' })
  await expect(railItems).toHaveCount(beforeCancel)

  const secondMembers = overviewIds.slice(3, 5)
  await select(secondMembers)
  await semanticDrop(secondMembers[0]!)
  await expect(railItems).toHaveCount(beforeCancel + 1)
  const sceneTwoEntry = railItems.last()
  const sceneTwoLabel = (await sceneTwoEntry.getAttribute('aria-label'))?.replace(/^进入[^：]+：/, '') ?? ''
  expect(sceneTwoLabel).not.toBe(sceneOneLabel)
  await sceneTwoEntry.click()
  await expect(page.locator('[data-node-id]')).toHaveCount(2)
  expect((await page.locator('[data-node-id]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-node-id')).sort()))).toEqual([...secondMembers].sort())

  await dock.getByRole('listitem', { name: new RegExp(`${sceneOneLabel}$`) }).click()
  expect((await page.locator('[data-node-id]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-node-id')).sort()))).toEqual([...firstMembers].sort())
  await dock.getByRole('listitem', { name: new RegExp(`${sceneTwoLabel}$`) }).click()
  expect((await page.locator('[data-node-id]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-node-id')).sort()))).toEqual([...secondMembers].sort())

  await page.waitForTimeout(1200)
  await page.reload()
  await expect(dock).toBeVisible()
  await dock.getByRole('listitem', { name: new RegExp(`${sceneOneLabel}$`) }).click()
  expect((await page.locator('[data-node-id]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-node-id')).sort()))).toEqual([...firstMembers].sort())
  await dock.getByRole('listitem', { name: new RegExp(`${sceneTwoLabel}$`) }).click()
  expect((await page.locator('[data-node-id]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-node-id')).sort()))).toEqual([...secondMembers].sort())
})

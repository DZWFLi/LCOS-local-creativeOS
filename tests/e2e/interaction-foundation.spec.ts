import { expect, test, type Locator, type Page } from '@playwright/test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createMvpSampleSnapshot } from '../../apps/local-core/src/mvp-sample-project'

let sampleRoot = ''
let projectId = ''
let projectCounter = 0

test.beforeAll(() => { sampleRoot = mkdtempSync(path.join(tmpdir(), 'lcos-interaction-e2e-')) })
test.afterAll(() => { if (sampleRoot) rmSync(sampleRoot, { recursive: true, force: true }) })
test.beforeEach(async ({ request }) => {
  projectCounter += 1
  projectId = `interaction-e2e-${Date.now()}-${projectCounter}`
  const seed = createMvpSampleSnapshot(sampleRoot)
  const identityValues = [
    ...seed.scopes, ...seed.workspaces, ...seed.artifacts, ...seed.artifactViews,
    ...seed.relations, ...seed.notes, ...seed.artifactRevisions, ...seed.fileRecords, ...seed.checkpoints,
  ].map((item) => String(item.id))
  let serialized = JSON.stringify(seed).split(String(seed.project.id)).join(projectId)
  for (const identity of identityValues.sort((a, b) => b.length - a.length)) {
    serialized = serialized.split(identity).join(`${projectId}--${identity}`)
  }
  const snapshot = JSON.parse(serialized) as typeof seed
  const response = await request.put(`/api/local-core/v1/projects/${projectId}/graph`, { data: { snapshot } })
  expect(response.ok(), await response.text()).toBe(true)
})
test.afterEach(async ({ request }) => {
  if (projectId) await request.delete(`/api/local-core/v1/projects/${projectId}`)
})

async function openCanvas(page: Page, fitContent = true) {
  await page.goto(`/?project=${projectId}`)
  const canvas = page.getByTestId('canvas')
  await expect(canvas).toBeVisible()
  await page.waitForFunction(() => {
    const target = document.querySelector('[data-testid="canvas"]')
    return Boolean(target && !target.hasAttribute('data-locked') && document.querySelectorAll('[data-node-id]').length >= 3)
  }, undefined, { timeout: 15_000 })
  await page.waitForTimeout(600)
  if (fitContent) {
    await page.getByRole('button', { name: '定位内容' }).click()
    await page.waitForTimeout(120)
  }
  return canvas
}

async function center(locator: Locator) {
  const box = await locator.boundingBox()
  if (!box) throw new Error('Interactive target has no bounding box')
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

async function nodeGesturePoint(page: Page, nodeId: string) {
  return page.evaluate((id) => {
    const node = document.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(id)}"]`)
    if (!node) throw new Error(`Node ${id} is missing`)
    const rect = node.getBoundingClientRect()
    for (const yRatio of [.7, .55, .4, .8, .25]) {
      for (const xRatio of [.5, .35, .65, .2, .8]) {
        const x = rect.left + rect.width * xRatio
        const y = rect.top + rect.height * yRatio
        const hit = document.elementFromPoint(x, y) as HTMLElement | null
        if (hit?.closest<HTMLElement>('[data-node-id]')?.dataset.nodeId === id
          && !hit.closest('button, input, textarea, select, [contenteditable="true"], .resize-handle')) return { x, y }
      }
    }
    throw new Error(`Node ${id} has no unobstructed gesture point`)
  }, nodeId)
}

async function blankCanvasPoint(page: Page) {
  return page.evaluate(() => {
    const canvas = document.querySelector<HTMLElement>('[data-testid="canvas"]')
    if (!canvas) throw new Error('Canvas is missing')
    const rect = canvas.getBoundingClientRect()
    for (const yRatio of [.18, .32, .48, .64]) {
      for (const xRatio of [.82, .68, .54, .4]) {
        const x = rect.left + rect.width * xRatio
        const y = rect.top + rect.height * yRatio
        const hit = document.elementFromPoint(x, y) as HTMLElement | null
        if (!hit?.closest('[data-node-id], [data-workspace-frame], button, .edge, .edge-control, .selection-bounds, .selection-composer')) return { x, y }
      }
    }
    throw new Error('Canvas has no unobstructed test point')
  })
}

async function visibleNodes(page: Page) {
  return page.locator('[data-node-id]').evaluateAll((elements) => elements
    .map((element) => {
      const rect = element.getBoundingClientRect()
      return { id: element.getAttribute('data-node-id') ?? '', x: rect.x, y: rect.y, width: rect.width, height: rect.height }
    })
    .filter((item) => item.id && item.width > 40 && item.height > 24 && item.x >= 52 && item.y >= 42 && item.x + item.width <= 1280 && item.y + item.height <= 654))
}

test.describe('LCOS Interaction Foundation', () => {
  test('selection, drag threshold, trailing click, double click and middle pan stay isolated', async ({ page }) => {
    const canvas = await openCanvas(page)
    const items = await visibleNodes(page)
    expect(items.length).toBeGreaterThanOrEqual(2)
    const first = page.getByTestId(`canvas-node-${items[0].id}`)
    const second = page.getByTestId(`canvas-node-${items[1].id}`)

    for (let index = 0; index < 10; index += 1) {
      await first.click()
      await second.click()
    }
    await expect(page.getByTestId('artifact-workbench')).toHaveCount(0)

    const before = await first.evaluate((element) => ({ left: Number.parseFloat((element as HTMLElement).style.left), top: Number.parseFloat((element as HTMLElement).style.top) }))
    let point = await nodeGesturePoint(page, items[0].id)
    await page.mouse.move(point.x, point.y)
    await page.mouse.down()
    await page.mouse.move(point.x + 3, point.y + 2)
    await page.mouse.up()
    await expect.poll(() => first.evaluate((element) => Number.parseFloat((element as HTMLElement).style.left))).toBe(before.left)

    point = await nodeGesturePoint(page, items[0].id)
    await page.mouse.move(point.x, point.y)
    await page.mouse.down()
    await page.mouse.move(point.x + 24, point.y + 16, { steps: 4 })
    await page.mouse.up()
    await expect.poll(() => first.evaluate((element) => Number.parseFloat((element as HTMLElement).style.left))).toBeGreaterThan(before.left + 10)
    await first.click()
    await expect(page.getByTestId('artifact-workbench')).toHaveCount(0)

    await first.dblclick()
    await expect(page.getByTestId('artifact-workbench')).toBeVisible()
    await page.getByRole('button', { name: '关闭工作台' }).click()

    const cameraBefore = Number(await canvas.getAttribute('data-camera-x'))
    const canvasPoint = await blankCanvasPoint(page)
    await page.mouse.move(canvasPoint.x, canvasPoint.y)
    await page.mouse.down({ button: 'middle' })
    await page.mouse.move(canvasPoint.x + 60, canvasPoint.y + 30, { steps: 4 })
    await page.mouse.up({ button: 'middle' })
    await expect.poll(async () => Number(await canvas.getAttribute('data-camera-x'))).toBeGreaterThan(cameraBefore + 45)
    const zoomBefore = Number(await canvas.getAttribute('data-camera-zoom'))
    await page.keyboard.down('Control')
    await page.mouse.wheel(0, -120)
    await page.keyboard.up('Control')
    await expect.poll(async () => Number(await canvas.getAttribute('data-camera-zoom'))).toBeGreaterThan(zoomBefore)
    await page.keyboard.press('Control+z')
  })

  test('marquee selection supports group drag and reversible delete', async ({ page }) => {
    await openCanvas(page)
    const items = await visibleNodes(page)
    expect(items.length).toBeGreaterThanOrEqual(2)
    const pair = items.slice(0, 2)
    const left = Math.min(...pair.map((item) => item.x)) - 12
    const top = Math.min(...pair.map((item) => item.y)) - 12
    const right = Math.max(...pair.map((item) => item.x + item.width)) + 12
    const bottom = Math.max(...pair.map((item) => item.y + item.height)) + 12
    await page.mouse.move(left, top)
    await page.mouse.down()
    await page.mouse.move(right, bottom, { steps: 8 })
    await expect(page.getByTestId('selection-marquee')).toBeVisible()
    await page.mouse.up()
    const selected = page.locator('[data-node-id].selected')
    expect(await selected.count()).toBeGreaterThanOrEqual(2)

    const selectedIds = await selected.evaluateAll((elements) => elements.map((element) => element.getAttribute('data-node-id') ?? ''))
    const positionsBefore = await selected.evaluateAll((elements) => elements.map((element) => ({ id: element.getAttribute('data-node-id'), left: Number.parseFloat((element as HTMLElement).style.left), top: Number.parseFloat((element as HTMLElement).style.top) })))
    const selectedBoxes = await selected.evaluateAll((elements) => elements.map((element) => {
      const rect = element.getBoundingClientRect()
      return { id: element.getAttribute('data-node-id') ?? '', x: rect.x, y: rect.y, width: rect.width, height: rect.height }
    }))
    const dragSource = selectedBoxes.reduce((current, candidate) => candidate.y > current.y ? candidate : current)
    const dragPoint = await nodeGesturePoint(page, dragSource.id)
    await page.mouse.move(dragPoint.x, dragPoint.y)
    await page.mouse.down()
    await page.mouse.move(dragPoint.x + 32, dragPoint.y + 20, { steps: 5 })
    await page.mouse.up()
    const positionsAfter = await page.locator('[data-node-id]').evaluateAll((elements, ids) => elements.filter((element) => ids.includes(element.getAttribute('data-node-id') ?? '')).map((element) => ({ id: element.getAttribute('data-node-id'), left: Number.parseFloat((element as HTMLElement).style.left), top: Number.parseFloat((element as HTMLElement).style.top) })), selectedIds)
    expect(await page.locator('[data-node-id].selected').count()).toBe(selectedIds.length)
    for (const before of positionsBefore) {
      const after = positionsAfter.find((item) => item.id === before.id)
      expect(after?.left).toBeGreaterThan(before.left + 10)
      expect(after?.top).toBeGreaterThan(before.top + 5)
    }

    const countBeforeDelete = await page.locator('[data-node-id]').count()
    await page.keyboard.press('Delete')
    await expect(page.locator('[data-node-id]')).toHaveCount(countBeforeDelete - selectedIds.length)
    await page.keyboard.press('Control+z')
    await expect(page.locator('[data-node-id]')).toHaveCount(countBeforeDelete)
    await page.keyboard.press('Control+z')
  })

  test('relation creation, endpoint reconnect, cut and anchor-to-empty are complete gestures', async ({ page }) => {
    const canvas = await openCanvas(page)
    const items = await visibleNodes(page)
    expect(items.length).toBeGreaterThanOrEqual(3)
    const pairs = await page.locator('.edge').evaluateAll((elements) => elements.map((element) => `${element.getAttribute('data-edge-from')}→${element.getAttribute('data-edge-to')}`))
    let source = items[0]
    let target = items[1]
    outer: for (const candidateSource of items) {
      for (const candidateTarget of items) {
        if (candidateSource.id !== candidateTarget.id && !pairs.includes(`${candidateSource.id}→${candidateTarget.id}`)) {
          source = candidateSource
          target = candidateTarget
          break outer
        }
      }
    }
    const reconnectTarget = items.find((item) => item.id !== source.id && item.id !== target.id) ?? items[2]
    const countBefore = Number(await canvas.getAttribute('data-edge-count'))
    const anchor = await center(page.getByTestId(`anchor-out-${source.id}`))
    const targetPoint = await center(page.getByTestId(`canvas-node-${target.id}`))
    await page.mouse.move(anchor.x, anchor.y)
    await page.mouse.down()
    await page.mouse.move(targetPoint.x, targetPoint.y, { steps: 8 })
    await page.mouse.up()
    await expect.poll(async () => Number(await canvas.getAttribute('data-edge-count'))).toBe(countBefore + 1)
    const createdId = await page.locator('.edge.selected').getAttribute('data-edge-id')
    expect(createdId).toBeTruthy()

    const reconnectHandle = page.getByTestId(`edge-reconnect-to-${createdId}`)
    const reconnectPoint = await center(page.getByTestId(`canvas-node-${reconnectTarget.id}`))
    const reconnectStart = await center(reconnectHandle)
    await page.mouse.move(reconnectStart.x, reconnectStart.y)
    await page.mouse.down()
    await page.mouse.move(reconnectPoint.x, reconnectPoint.y, { steps: 8 })
    await page.mouse.up()
    await expect(page.locator(`.edge[data-edge-id="${createdId}"]`)).toHaveAttribute('data-edge-to', reconnectTarget.id)

    await page.getByTestId(`edge-cut-${createdId}`).click({ force: true })
    await expect.poll(async () => Number(await canvas.getAttribute('data-edge-count'))).toBe(countBefore)

    const canvasBox = await canvas.boundingBox()
    if (!canvasBox) throw new Error('Canvas bounds unavailable')
    const empty = { x: canvasBox.x + canvasBox.width * .72, y: canvasBox.y + canvasBox.height * .28 }
    const emptyAnchor = await center(page.getByTestId(`anchor-out-${source.id}`))
    await page.mouse.move(emptyAnchor.x, emptyAnchor.y)
    await page.mouse.down()
    await page.mouse.move(empty.x, empty.y, { steps: 8 })
    await page.mouse.up()
    await expect(page.getByTestId('anchor-create-menu')).toBeVisible()
    await page.getByRole('button', { name: '取消' }).click()
  })

  test('minimap node location changes the camera without changing project objects', async ({ page }) => {
    const canvas = await openCanvas(page, false)
    const objectCount = await page.locator('[data-node-id]').count()
    const cameraBefore = { x: await canvas.getAttribute('data-camera-x'), y: await canvas.getAttribute('data-camera-y') }
    const mapBox = await page.getByTestId('minimap-map').boundingBox()
    if (!mapBox) throw new Error('Minimap bounds unavailable')
    await page.mouse.click(mapBox.x + 8, mapBox.y + 8)
    const cameraAfterFirst = { x: await canvas.getAttribute('data-camera-x'), y: await canvas.getAttribute('data-camera-y') }
    await page.mouse.click(mapBox.x + mapBox.width - 8, mapBox.y + mapBox.height - 8)
    const cameraAfterLast = { x: await canvas.getAttribute('data-camera-x'), y: await canvas.getAttribute('data-camera-y') }
    expect(cameraAfterFirst).not.toEqual(cameraBefore)
    expect(cameraAfterLast).not.toEqual(cameraAfterFirst)
    await expect(page.locator('[data-node-id]')).toHaveCount(objectCount)
    await expect(page.getByTestId('minimap-camera-rect')).toBeVisible()
  })

  test('node presentation persists through Local Core while camera restores as navigation preference', async ({ page, request }) => {
    const canvas = await openCanvas(page)
    const items = await visibleNodes(page)
    const target = items[0]
    const node = page.getByTestId(`canvas-node-${target.id}`)
    const worldBefore = Number.parseFloat(await node.evaluate((element) => (element as HTMLElement).style.left))
    const dragPoint = await nodeGesturePoint(page, target.id)
    await page.mouse.move(dragPoint.x, dragPoint.y)
    await page.mouse.down()
    await page.mouse.move(dragPoint.x + 28, dragPoint.y + 18, { steps: 5 })
    await page.mouse.up()
    const worldAfter = Number.parseFloat(await node.evaluate((element) => (element as HTMLElement).style.left))
    expect(worldAfter).toBeGreaterThan(worldBefore + 10)

    await expect.poll(async () => {
      const response = await request.get(`/api/local-core/v1/projects/${projectId}/graph`)
      const body = await response.json() as { value?: { artifactViews?: Array<{ id: string; position: { x: number } }> } }
      return body.value?.artifactViews?.find((view) => view.id === target.id)?.position.x
    }, { timeout: 8_000 }).toBeCloseTo(worldAfter, 2)

    const blank = await blankCanvasPoint(page)
    await page.mouse.move(blank.x, blank.y)
    await page.mouse.down({ button: 'middle' })
    await page.mouse.move(blank.x + 70, blank.y + 35, { steps: 5 })
    await page.mouse.up({ button: 'middle' })
    const cameraBeforeReload = {
      x: Number(await canvas.getAttribute('data-camera-x')),
      y: Number(await canvas.getAttribute('data-camera-y')),
      zoom: Number(await canvas.getAttribute('data-camera-zoom')),
    }
    await page.waitForTimeout(3_300)
    await page.reload()
    await page.waitForFunction(() => {
      const targetCanvas = document.querySelector('[data-testid="canvas"]')
      return Boolean(targetCanvas && !targetCanvas.hasAttribute('data-locked'))
    }, undefined, { timeout: 15_000 })
    await expect.poll(() => page.getByTestId(`canvas-node-${target.id}`).evaluate((element) => Number.parseFloat((element as HTMLElement).style.left))).toBeCloseTo(worldAfter, 2)
    await expect.poll(async () => Number(await page.getByTestId('canvas').getAttribute('data-camera-x'))).toBeCloseTo(cameraBeforeReload.x, 1)
    await expect.poll(async () => Number(await page.getByTestId('canvas').getAttribute('data-camera-y'))).toBeCloseTo(cameraBeforeReload.y, 1)
    await expect.poll(async () => Number(await page.getByTestId('canvas').getAttribute('data-camera-zoom'))).toBeCloseTo(cameraBeforeReload.zoom, 2)
  })
})

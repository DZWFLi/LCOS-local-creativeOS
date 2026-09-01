import { expect, test, type Page } from '@playwright/test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createMvpSampleSnapshot } from '../../apps/local-core/src/mvp-sample-project'
import { createLocalCoreHarness } from './local-core-harness'

const harness = createLocalCoreHarness()
let sampleRoot = ''
let projectId = ''

async function seedProject(request: import('@playwright/test').APIRequestContext) {
  projectId = `phase-a-admission-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const seed = createMvpSampleSnapshot(sampleRoot)
  seed.workspaces[0] = { ...seed.workspaces[0]!, focusedViewIds: seed.artifactViews.map((view) => view.id) }
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
}

async function openCanvas(page: Page) {
  await page.goto(`/?project=${projectId}`)
  const canvas = page.getByTestId('canvas')
  await expect(canvas).toBeVisible({ timeout: 15_000 })
  await page.waitForFunction(() => {
    const target = document.querySelector('[data-testid="canvas"]')
    return Boolean(target && !target.hasAttribute('data-locked') && document.querySelectorAll('[data-node-id]').length >= 2)
  }, undefined, { timeout: 15_000 })
  const close = page.getByRole('button', { name: '关闭提示' })
  if (await close.count()) await close.click().catch(() => undefined)
  return canvas
}

function firstArtifact(page: Page) {
  return page.locator('[data-testid^="canvas-node-"][data-artifact-id]:not([data-entity-kind="conversation"])').first()
}

async function cameraSnapshot(page: Page) {
  const canvas = page.getByTestId('canvas')
  return {
    x: Number(await canvas.getAttribute('data-camera-x')),
    y: Number(await canvas.getAttribute('data-camera-y')),
    zoom: Number(await canvas.getAttribute('data-camera-zoom')),
  }
}

async function setCanvasZoom(page: Page, targetZoom: number) {
  const canvas = page.getByTestId('canvas')
  await canvas.evaluate((element, target) => {
    const current = Number(element.getAttribute('data-camera-zoom') ?? '1')
    const rect = element.getBoundingClientRect()
    const sensitivity = 0.0035
    const deltaY = -Math.log(target / current) / sensitivity
    element.dispatchEvent(new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
      deltaY,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
    }))
  }, targetZoom)
  await expect.poll(async () => Number(await canvas.getAttribute('data-camera-zoom'))).toBeCloseTo(targetZoom, 2)
}

async function installFakeVoiceBrowser(page: Page) {
  await page.addInitScript(() => {
    const fakeTrack = { stop() {} }
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: async () => ({ getTracks: () => [fakeTrack] }) },
    })
    class FakeMediaRecorder {
      static isTypeSupported(type: string) { return type.startsWith('audio/') }
      state = 'inactive'
      mimeType: string
      ondataavailable: ((event: { data: Blob }) => void) | null = null
      onstop: (() => void) | null = null
      onerror: (() => void) | null = null
      constructor(_stream: unknown, options?: { mimeType?: string }) { this.mimeType = options?.mimeType ?? 'audio/webm' }
      start() { this.state = 'recording' }
      stop() {
        if (this.state === 'inactive') return
        this.state = 'inactive'
        queueMicrotask(() => {
          this.ondataavailable?.({ data: new Blob(['phase-a-voice'], { type: this.mimeType }) })
          this.onstop?.()
        })
      }
    }
    Object.defineProperty(globalThis, 'MediaRecorder', { configurable: true, value: FakeMediaRecorder })
  })
}

async function attachVisualEvidence(page: Page, name: string) {
  const png = await page.screenshot({ fullPage: true })
  await test.info().attach(name, { body: png, contentType: 'image/png' })
}

test.beforeAll(async () => {
  await harness.start()
  sampleRoot = mkdtempSync(path.join(tmpdir(), 'lcos-phase-a-admission-'))
})

test.afterAll(async () => {
  if (sampleRoot) rmSync(sampleRoot, { recursive: true, force: true })
  await harness.stop()
})

test.beforeEach(async ({ request }) => { await seedProject(request) })
test.afterEach(async ({ request }) => { if (projectId) await request.delete(`/api/local-core/v1/projects/${projectId}`) })

test('Search uses the one top slot and hands a locatable result to Focus', async ({ page }) => {
  await openCanvas(page)
  await page.keyboard.press('Control+f')
  await expect(page.getByTestId('centered-search-control')).toBeVisible()
  await expect(page.getByTestId('centered-spatial-index')).toHaveAttribute('data-spatial-index-owner', 'search')
  await expect(page.getByTestId('project-tools-dialog')).toHaveCount(0)
  await page.getByRole('textbox', { name: '搜索当前项目' }).fill('Brief')
  await expect.poll(async () => page.locator('.lcos-centered-spatial-index-item.is-result').count()).toBeGreaterThan(0)
  await page.getByRole('textbox', { name: '搜索当前项目' }).press('Enter')
  await expect(page.getByTestId('centered-spatial-index')).toHaveAttribute('data-spatial-index-owner', 'focus')
  await expect(page.getByTestId('centered-search-control')).toHaveCount(0)
  await expect(page.locator('.project-focus-navigator')).toHaveCount(0)
})

test('Focus hotkey stays transient and does not resurrect the old large navigator', async ({ page }) => {
  await openCanvas(page)
  const artifact = firstArtifact(page)
  await expect(artifact).toBeVisible()
  await artifact.click()
  await page.keyboard.press('f')
  await expect(page.getByTestId('centered-spatial-index')).toHaveAttribute('data-spatial-index-owner', 'focus')
  await expect(page.locator('.project-focus-navigator')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('centered-spatial-index')).toHaveCount(0)
})

test('Color Pin authors canonical membership, renders local identity and hands one member to Focus', async ({ page }) => {
  await openCanvas(page)
  const artifact = firstArtifact(page)
  await expect(artifact).toBeVisible()
  const nodeId = await artifact.getAttribute('data-node-id')
  expect(nodeId).toBeTruthy()
  await artifact.click()
  await expect(page.locator('[data-lcos-orbit-action="object-color-pin"]')).toBeVisible()
  await page.locator('[data-lcos-orbit-action="object-color-pin"]').click()
  const authoring = page.getByTestId('color-pin-authoring-popover')
  await expect(authoring).toBeVisible()
  const addColor = authoring.getByRole('button', { name: /^添加 #/ }).first()
  await expect(addColor).toBeVisible()
  await addColor.click()
  await expect(page.getByTestId(`color-pin-local-dots-${nodeId}`)).toBeVisible()
  await page.getByRole('button', { name: '关闭 Color Pin' }).click()
  await page.keyboard.press('Escape').catch(() => undefined)
  await expect(page.getByTestId('centered-spatial-index')).toHaveAttribute('data-spatial-index-owner', 'color-pin')
  const colorIndexItem = page.locator('.lcos-centered-spatial-index-item').first()
  await expect(colorIndexItem).toBeVisible()
  await colorIndexItem.click()
  await expect(page.getByTestId('centered-spatial-index')).toHaveAttribute('data-spatial-index-owner', 'focus')
})

test('Voice morphology runs Recording → Transcribing → editable text without auto-send', async ({ page }) => {
  await installFakeVoiceBrowser(page)
  await page.route('**/api/local-core/v1/runtime/voice/transcriptions', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, value: { text: '浏览器语音验收文本', providerId: 'phase-a-browser-fixture' } }),
    })
  })
  await openCanvas(page)
  const artifact = firstArtifact(page)
  await artifact.click()
  await page.keyboard.press('c')
  const composer = page.getByTestId('selection-composer')
  await expect(composer).toBeVisible()
  await expect(composer).toHaveAttribute('data-voice-state', 'idle')
  await composer.getByRole('button', { name: '语音输入' }).click()
  await expect(composer).toHaveAttribute('data-voice-state', 'recording')
  await expect(composer.getByRole('button', { name: '停止并转成文字' })).toBeVisible()
  await expect(composer.locator('.lcos-composer-send')).toHaveCount(0)
  await composer.getByRole('button', { name: '停止并转成文字' }).click()
  await expect(composer).toHaveAttribute('data-voice-state', 'editable')
  await expect(composer.getByTestId('selection-composer-input')).toHaveValue(/浏览器语音验收文本/)
  await expect(composer.locator('.lcos-composer-send')).toBeVisible()
  await expect(composer).toBeVisible()
})

test('occupied right region moves HUD safe center without moving Camera', async ({ page }) => {
  await openCanvas(page)
  const beforeCamera = await cameraSnapshot(page)
  await page.keyboard.press('Control+f')
  const index = page.getByTestId('centered-spatial-index')
  await expect(index).toHaveAttribute('data-spatial-index-owner', 'search')
  const beforeAnchor = await index.evaluate((element) => Number.parseFloat(getComputedStyle(element).getPropertyValue('--lcos-spatial-index-anchor-x')))
  await page.evaluate(() => {
    const blocker = document.createElement('aside')
    blocker.dataset.phaseASmokeOccupant = 'true'
    blocker.setAttribute('data-spatial-viewport-occupant', 'right')
    Object.assign(blocker.style, { position: 'fixed', right: '0', top: '0', width: '360px', height: '100vh', pointerEvents: 'none', visibility: 'hidden' })
    document.body.appendChild(blocker)
  })
  await expect.poll(async () => index.evaluate((element) => Number.parseFloat(getComputedStyle(element).getPropertyValue('--lcos-spatial-index-anchor-x')))).toBeLessThan(beforeAnchor - 100)
  expect(await cameraSnapshot(page)).toEqual(beforeCamera)
  await attachVisualEvidence(page, `phase-a-occupied-${test.info().project.name}.png`)
})

test('canvas zoom evidence covers 25/35/60/100/150 percent at current DPR', async ({ page }) => {
  await openCanvas(page)
  for (const zoom of [0.25, 0.35, 0.6, 1, 1.5]) {
    await setCanvasZoom(page, zoom)
    await expect(page.getByTestId('canvas')).toHaveAttribute('data-camera-zoom', new RegExp(`^${zoom}`))
    await attachVisualEvidence(page, `phase-a-zoom-${Math.round(zoom * 100)}-${test.info().project.name}.png`)
  }
})

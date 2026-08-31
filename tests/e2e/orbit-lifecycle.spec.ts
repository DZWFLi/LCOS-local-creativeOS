import { expect, test, type Page } from '@playwright/test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createMvpSampleSnapshot } from '../../apps/local-core/src/mvp-sample-project'
import { createLocalCoreHarness } from './local-core-harness'

/**
 * A02 Orbit click-open lifecycle browser regression guard.
 *
 * L0 verdict: Orbit is an object-local action layer, not a hover tooltip. Once opened
 * by click it survives pointer leave and closes only through an explicit lifecycle
 * transition: action, outside press, Esc, selection change, or deeper viewer.
 */

let sampleRoot = ''
let projectId = ''
let conversationId = ''
const harness = createLocalCoreHarness()

test.beforeAll(async () => {
  await harness.start()
  sampleRoot = mkdtempSync(path.join(tmpdir(), 'lcos-orbit-e2e-'))
})

test.afterAll(async () => {
  if (sampleRoot) rmSync(sampleRoot, { recursive: true, force: true })
  await harness.stop()
})

test.beforeEach(async ({ request }) => {
  projectId = `orbit-e2e-${Date.now()}`
  const seed = createMvpSampleSnapshot(sampleRoot)
  seed.workspaces[0] = { ...seed.workspaces[0]!, focusedViewIds: seed.artifactViews.map((view) => view.id) }
  const identityValues = [
    ...seed.scopes,
    ...seed.workspaces,
    ...seed.artifacts,
    ...seed.artifactViews,
    ...seed.relations,
    ...seed.notes,
    ...seed.artifactRevisions,
    ...seed.fileRecords,
    ...seed.checkpoints,
  ].map((item) => String(item.id))

  let serialized = JSON.stringify(seed).split(String(seed.project.id)).join(projectId)
  for (const identity of identityValues.sort((a, b) => b.length - a.length)) {
    serialized = serialized.split(identity).join(`${projectId}--${identity}`)
  }
  const snapshot = JSON.parse(serialized) as typeof seed
  const response = await request.put(`/api/local-core/v1/projects/${projectId}/graph`, { data: { snapshot } })
  expect(response.ok(), await response.text()).toBe(true)

  const firstViewRef = snapshot.artifactViews[0]
  expect(firstViewRef).toBeTruthy()

  const created = await request.post(`/api/local-core/v1/projects/${projectId}/connected-conversations`, {
    data: { action: 'create', provider: 'codex', executorId: 'orbit-e2e-executor', label: 'e2e orbit 会话' },
  })
  expect(created.ok(), await created.text()).toBe(true)
  const createdBody = await created.json()
  conversationId = createdBody.value?.connectedConversationId ?? createdBody.value?.id ?? createdBody.value?.conversationRef
  expect(conversationId).toBeTruthy()

  const linked = await request.post(`/api/local-core/v1/projects/${projectId}/connected-conversations/${conversationId}/link-session`, {
    data: { input: { conversationSessionId: firstViewRef!.id } },
  })
  expect(linked.ok(), await linked.text()).toBe(true)
})

test.afterEach(async ({ request }) => {
  if (projectId) await request.delete(`/api/local-core/v1/projects/${projectId}`)
})

async function openCanvas(page: Page) {
  await page.goto(`/?project=${projectId}`)
  const canvas = page.getByTestId('canvas')
  await expect(canvas).toBeVisible()
  await page.waitForTimeout(1000)
  return canvas
}

function glyphLocator(page: Page) {
  return page.locator('.lcos-conversation-glyth')
}

async function closeContinuationPanel(page: Page) {
  const close = page.getByRole('button', { name: '关闭提示' })
  if (await close.count()) await close.click().catch(() => undefined)
}

test('click-open Orbit survives pointer leave and Esc closes it', async ({ page }) => {
  await openCanvas(page)
  await closeContinuationPanel(page)

  const glyph = glyphLocator(page)
  await expect(glyph.first()).toBeVisible({ timeout: 15_000 })

  await glyph.first().click()
  const orbitLayer = page.locator('.lcos-orbit-layer')
  await expect(orbitLayer).toBeVisible({ timeout: 5_000 })

  await page.mouse.move(640, 20)
  await page.waitForTimeout(1200)
  await expect(orbitLayer).toBeVisible({ timeout: 2_000 })

  await page.keyboard.press('Escape')
  await expect(orbitLayer).toHaveCount(0, { timeout: 2_000 })
})

test('outside press and satellite action close Orbit', async ({ page }) => {
  await openCanvas(page)
  await closeContinuationPanel(page)

  const glyph = glyphLocator(page)
  await expect(glyph.first()).toBeVisible({ timeout: 15_000 })
  await glyph.first().click()
  const orbitLayer = page.locator('.lcos-orbit-layer')
  await expect(orbitLayer).toBeVisible({ timeout: 5_000 })

  await page.mouse.click(900, 620)
  await expect(orbitLayer).toHaveCount(0, { timeout: 2_000 })

  await glyph.first().click()
  await expect(orbitLayer).toBeVisible({ timeout: 5_000 })
  const satellite = page.locator('.lcos-orbit-satellite:not(.is-readonly)').first()
  await expect(satellite).toBeVisible({ timeout: 3_000 })
  await satellite.click()
  await expect(orbitLayer).toHaveCount(0, { timeout: 2_000 })
})

test('ordinary Artifact gets Universal ObjectOrbit and single Selection Strip stays retired', async ({ page }) => {
  await openCanvas(page)
  await closeContinuationPanel(page)

  const artifacts = page.locator('[data-testid^="canvas-node-"][data-artifact-id]:not([data-entity-kind="conversation"])')
  await expect(artifacts.first()).toBeVisible({ timeout: 15_000 })

  await artifacts.first().click()
  const orbitLayer = page.locator('.lcos-orbit-layer')
  await expect(orbitLayer).toBeVisible({ timeout: 5_000 })
  await expect(page.locator('[data-lcos-orbit-action="object-open"]')).toHaveCount(1)
  await expect(page.locator('[data-lcos-orbit-action="object-locate"]')).toHaveCount(1)
  await expect(page.locator('[data-lcos-orbit-action="object-pin"]')).toHaveCount(1)
  await expect(page.getByTestId('selection-toolbar')).toHaveCount(0)
  await expect(page.getByTestId('selection-group-actions')).toHaveCount(0)

  if (await artifacts.count() > 1) {
    await artifacts.nth(1).click({ modifiers: ['Shift'] })
    await expect(orbitLayer).toHaveCount(0, { timeout: 2_000 })
    await expect(page.getByTestId('selection-group-actions')).toBeVisible({ timeout: 2_000 })
    await page.getByTestId('selection-group-actions-trigger').click()
    await expect(page.getByTestId('selection-group-menu')).toBeVisible({ timeout: 2_000 })
    await expect(page.locator('[data-selection-group-action="selection-reorganize"]')).toHaveCount(1)
    await expect(page.locator('[data-selection-group-action="selection-copy"]')).toHaveCount(1)
  }
})

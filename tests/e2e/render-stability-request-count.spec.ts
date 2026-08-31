import { expect, test, type Page } from '@playwright/test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createMvpSampleSnapshot } from '../../apps/local-core/src/mvp-sample-project'
import { createLocalCoreHarness } from './local-core-harness'

/**
 * Phase A / P0 render-request stability regression guard.
 *
 * The bug class is unstable React reference dependencies that turn a semantic write
 * into a feedback loop (render -> active-context write -> state update -> render).
 * This spec counts the two request families that previously made the loop visible.
 */
let sampleRoot = ''
let projectId = ''
let projectCounter = 0
const harness = createLocalCoreHarness()

test.beforeAll(async () => {
  await harness.start()
  sampleRoot = mkdtempSync(path.join(tmpdir(), 'lcos-render-stability-e2e-'))
})

test.afterAll(async () => {
  if (sampleRoot) rmSync(sampleRoot, { recursive: true, force: true })
  await harness.stop()
})

test.beforeEach(async ({ request }) => {
  projectCounter += 1
  projectId = `render-stability-e2e-${Date.now()}-${projectCounter}`
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
})

test.afterEach(async ({ request }) => {
  if (projectId) await request.delete(`/api/local-core/v1/projects/${projectId}`)
})

interface RequestCounters {
  activeContext: number
  attentionRuntime: number
}

interface WrappedWindow extends Window {
  __lcosReqCounters?: RequestCounters
}

async function installRequestCounter(page: Page) {
  await page.evaluate(() => {
    const wrapped = window as unknown as WrappedWindow
    if (wrapped.__lcosReqCounters) return
    const counters: RequestCounters = { activeContext: 0, attentionRuntime: 0 }
    const originalFetch = globalThis.fetch.bind(globalThis)
    globalThis.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      if (init?.method === 'PUT' && url.includes('/active-context')) counters.activeContext += 1
      if (url.includes('/attention/runtime')) counters.attentionRuntime += 1
      return originalFetch(input, init)
    }
    wrapped.__lcosReqCounters = counters
  })
}

async function readCounters(page: Page): Promise<RequestCounters> {
  return page.evaluate(() => {
    const wrapped = window as unknown as WrappedWindow
    return {
      activeContext: wrapped.__lcosReqCounters?.activeContext ?? 0,
      attentionRuntime: wrapped.__lcosReqCounters?.attentionRuntime ?? 0,
    }
  })
}

async function openCanvas(page: Page) {
  await page.goto(`/?project=${projectId}`)
  const canvas = page.getByTestId('canvas')
  await expect(canvas).toBeVisible()
  await page.waitForTimeout(800)
  await installRequestCounter(page)
  return canvas
}

function delta(after: RequestCounters, before: RequestCounters): RequestCounters {
  return {
    activeContext: after.activeContext - before.activeContext,
    attentionRuntime: after.attentionRuntime - before.attentionRuntime,
  }
}

test('idle canvas does not produce an active-context/attention request feedback loop', async ({ page }) => {
  await openCanvas(page)
  const before = await readCounters(page)
  await page.waitForTimeout(6000)
  const requests = delta(await readCounters(page), before)

  expect(requests.activeContext, `idle /active-context requests: ${requests.activeContext}`).toBeLessThanOrEqual(2)
  expect(requests.attentionRuntime, `idle /attention/runtime requests: ${requests.attentionRuntime}`).toBeLessThanOrEqual(3)
})

test('repeated selection creates bounded semantic writes, not a render storm', async ({ page }) => {
  await openCanvas(page)
  const clickable = page.locator('[data-node-id]')
  const nodeCount = await clickable.count()
  expect(nodeCount).toBeGreaterThan(1)

  const sample = Math.min(12, nodeCount)
  const before = await readCounters(page)
  for (let index = 0; index < sample; index += 1) {
    const box = await clickable.nth(index).boundingBox()
    if (!box) continue
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    await page.waitForTimeout(120)
  }
  await page.waitForTimeout(1800)
  const requests = delta(await readCounters(page), before)

  expect(requests.activeContext, `selection /active-context requests: ${requests.activeContext}`).toBeLessThanOrEqual(sample + 3)
  expect(requests.attentionRuntime, `selection /attention/runtime requests: ${requests.attentionRuntime}`).toBeLessThanOrEqual(sample + 4)
  const depthError = await page.evaluate(() => document.body.textContent?.includes('Maximum update depth exceeded') ?? false)
  expect(depthError).toBe(false)
})

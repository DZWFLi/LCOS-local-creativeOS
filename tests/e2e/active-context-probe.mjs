/**
 * Slice D probe: GUI node selection → Local Core ActiveContext (PUT) → CLI-readable GET.
 * Requires the launcher stack (dev:open) already running with disposable-mvp-sample.
 */
import { readFileSync } from 'node:fs'
import { chromium } from '@playwright/test'

const CORE_URL = 'http://127.0.0.1:43121'
const token = readFileSync('.codex-runtime/local-core-token', 'utf8').trim()
const projectId = 'disposable-mvp-sample'

const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  await page.goto(`http://127.0.0.1:5173/?project=${projectId}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-node-id="view-brief"]', { timeout: 20_000 })
  const nodeIds = await page.$$eval('[data-node-id]', (elements) =>
    elements.map((element) => element.getAttribute('data-node-id')).filter((value) => value !== null),
  )
  const target = nodeIds[0]
  if (target === undefined) throw new Error('no canvas nodes found')
  console.log(`clicking node ${target}`)
  await page.click(`[data-node-id="${target}"]`)
  await page.waitForTimeout(1_000)

  const response = await fetch(`${CORE_URL}/projects/${projectId}/active-context`, {
    headers: { authorization: `Bearer ${token}` },
  })
  const body = await response.json()
  const selected = body.value?.selectedViewIds ?? []
  console.log(`selectedViewIds=${JSON.stringify(selected)}`)
  console.log(`selectedArtifacts=${JSON.stringify(body.value?.selectedArtifacts?.map((item) => item.title) ?? [])}`)
  if (!selected.includes(target)) {
    throw new Error(`expected ${target} in selectedViewIds, got ${JSON.stringify(selected)}`)
  }
  console.log('ACTIVE_CONTEXT_WRITEBACK_OK')
} finally {
  await browser.close()
}

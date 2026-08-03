/**
 * Slice E probe: double-click a file node → right-center Artifact Workbench,
 * preview focus → overview tab → Esc close. Requires dev:open stack running.
 */
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from '@playwright/test'

const projectId = 'disposable-mvp-sample'
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 860 } })
  await page.goto(`http://127.0.0.1:5173/?project=${projectId}`, { waitUntil: 'networkidle' })
  await page.waitForSelector('[data-node-id]', { timeout: 20_000 })

  // Prefer a file node (has fileRecordId / preview) over process nodes.
  const target = await page.$$eval('[data-node-id]', (elements) => {
    const fileNode = elements.find((element) =>
      element.getAttribute('data-node-kind') !== 'process' && element.getAttribute('data-file-record-id') !== null)
    return (fileNode ?? elements[0])?.getAttribute('data-node-id') ?? null
  })
  if (target === null) throw new Error('no node found')
  console.log(`double-clicking ${target}`)
  await page.dblclick(`[data-node-id="${target}"]`)
  await page.waitForSelector('[data-testid="artifact-workbench"]', { timeout: 8_000 })

  const heading = await page.locator('[data-testid="artifact-workbench"] h3').textContent()
  const focus = await page.locator('[data-testid="artifact-workbench"]').getAttribute('data-focus')
  console.log(`workbench open: heading=${heading} focus=${focus}`)

  await page.click('[data-testid="artifact-workbench"] .workbench-nav button:has-text("概览")')
  await page.waitForSelector('[data-testid="artifact-workbench"][data-focus="overview"]', { timeout: 5_000 })
  const metaCount = await page.locator('[data-testid="artifact-workbench"] .workbench-meta div').count()
  console.log(`overview meta rows=${metaCount}`)

  const outDir = join(import.meta.dirname, 'output', 'playwright')
  mkdirSync(outDir, { recursive: true })
  const shot = join(outDir, `workbench-${Date.now()}.png`)
  await page.screenshot({ path: shot, fullPage: false })
  console.log(`screenshot=${shot}`)

  await page.keyboard.press('Escape')
  await page.waitForTimeout(250)
  const closed = await page.locator('[data-testid="artifact-workbench"]').count()
  console.log(`after Esc: workbench count=${closed}`)
  if (closed !== 0) throw new Error('Esc did not close the workbench')

  await page.dblclick(`[data-node-id="${target}"]`)
  await page.waitForSelector('[data-testid="artifact-workbench"]', { timeout: 8_000 })
  console.log('WORKBENCH_PROBE_OK')
} finally {
  await browser.close()
}

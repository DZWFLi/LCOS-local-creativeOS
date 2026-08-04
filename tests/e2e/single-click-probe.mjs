import { chromium } from '@playwright/test'

const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } })
  const errors = []
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(`console: ${msg.text()}`) })
  await page.goto('http://127.0.0.1:5173/?project=disposable-mvp-sample', { waitUntil: 'networkidle' })
  await page.waitForSelector('[data-node-id]', { timeout: 20_000 })

  const nodeIds = await page.$$eval('[data-node-id]', (els) => els.map((el) => el.getAttribute('data-node-id')).filter(Boolean))
  console.log('nodes:', nodeIds.slice(0, 8).join(', '))
  const target = nodeIds[0]
  if (!target) throw new Error('no nodes')

  await page.click(`[data-node-id="${target}"]`, { delay: 30 })
  await page.waitForTimeout(500)
  const selectedCount = await page.locator(`[data-node-id="${target}"].selected`).count()
  const composer = await page.locator('[data-testid="selection-composer"]').count()
  const composerVisible = composer > 0
  const active = await page.evaluate(async () => {
    const res = await fetch('/api/local-core/v1/projects/disposable-mvp-sample/active-context')
    return await res.json()
  }).catch(() => null)
  console.log(`after single click: selected=${selectedCount} composer=${composerVisible}`)
  console.log(`activeContext version=${active?.value?.version} selectedViewIds=${JSON.stringify(active?.value?.selectedViewIds)}`)
  console.log(`errors=${errors.length ? errors.join(' | ') : 'none'}`)

  // agent=codex 视图单点 + 遮挡检查
  await page.goto('http://127.0.0.1:5173/?agent=codex&project=disposable-mvp-sample', { waitUntil: 'networkidle' })
  await page.waitForSelector('[data-node-id]', { timeout: 20_000 })
  const agentNode = (await page.$$eval('[data-node-id]', (els) => els.map((el) => el.getAttribute('data-node-id')).filter(Boolean)))[0]
  if (agentNode) {
    const box = await page.locator(`[data-node-id="${agentNode}"]`).boundingBox()
    const hit = box ? await page.evaluate(({ x, y }) => {
      const el = document.elementFromPoint(x + 40, y + 40)
      return el ? (el.closest('[data-node-id]')?.getAttribute('data-node-id') ?? el.tagName + '.' + (el.className ?? '')) : 'null'
    }, box) : 'nobox'
    await page.click(`[data-node-id="${agentNode}"]`, { delay: 30 })
    await page.waitForTimeout(500)
    const agentSelected = await page.locator(`[data-node-id="${agentNode}"].selected`).count()
    const agentComposer = await page.locator('[data-testid="selection-composer"]').count()
    const surfaceVersion = await page.locator('[data-testid="agent-context-surface"] code').textContent()
    console.log(`agent view: node=${agentNode} hit=${hit} selected=${agentSelected} composer=${agentComposer > 0} surfaceVersion=${surfaceVersion}`)
  }

  // 对比：双击
  await page.dblclick(`[data-node-id="${target}"]`)
  await page.waitForTimeout(500)
  const workbench = await page.locator('[data-testid="artifact-workbench"]').count()
  console.log(`after double click: workbench=${workbench > 0}`)
} finally {
  await browser.close()
}

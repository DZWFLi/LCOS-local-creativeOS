/**
 * Closeout 验收诊断：抓“节点在视口外 / 无限渲染 / agent 视图不 idle”的现场证据。
 * 需要 dev 栈在跑（Web 5173 / Core 43121）。
 */
import { chromium } from '@playwright/test'

const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } })
  const errors = []
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  page.on('console', (msg) => { if (msg.type() === 'error' || msg.type() === 'warning') errors.push(`${msg.type()}: ${msg.text()}`) })

  await page.goto('http://127.0.0.1:5173/?project=disposable-mvp-sample', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForSelector('[data-testid="creative-os-app"]', { timeout: 20000 })
  await page.waitForTimeout(5000)

  const canvas = page.locator('[data-testid="canvas"]')
  const canvasBox = await canvas.boundingBox()
  const canvasAttrs = await canvas.evaluate((el) => {
    const attrs = {}
    for (const name of el.getAttributeNames()) attrs[name] = el.getAttribute(name)
    return attrs
  })
  console.log('canvas attrs:', JSON.stringify(canvasAttrs, null, 2))
  const firstNode = page.locator('[data-node-id]').first()
  const nodeBox = await firstNode.boundingBox()
  console.log('canvas box:', JSON.stringify(canvasBox))
  console.log('first node box:', JSON.stringify(nodeBox))
  console.log('viewport:', await page.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight })))
  const nodeCount = await page.locator('[data-node-id]').count()
  console.log('node count:', nodeCount)
  const visibleNodes = await page.locator('[data-node-id]:visible').count()
  console.log('visible nodes (playwright visible):', visibleNodes)
  const nodeRects = await page.$$eval('[data-node-id]', (els) => els.slice(0, 12).map((el) => {
    const r = el.getBoundingClientRect()
    return { id: el.getAttribute('data-node-id'), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }
  }))
  console.log('node rects:', JSON.stringify(nodeRects))
  const transformInfo = await page.evaluate(() => {
    const canvas = document.querySelector('[data-testid="canvas"]')
    const transformed = []
    if (canvas) {
      for (const el of canvas.querySelectorAll('*')) {
        const t = getComputedStyle(el).transform
        if (t && t !== 'none') {
          transformed.push({ cls: el.className?.toString?.().slice(0, 60) ?? el.tagName, transform: t.slice(0, 90) })
          if (transformed.length >= 6) break
        }
      }
    }
    const node = document.querySelector('[data-node-id="view-brief"]')
    const rect = node ? node.getBoundingClientRect() : null
    return {
      transformed,
      nodeRect: rect ? { x: rect.x, y: rect.y, w: rect.width, h: rect.height } : null,
    }
  })
  console.log('transform info:', JSON.stringify(transformInfo))
  console.log('errors:', errors.length ? errors.slice(0, 10).join('\n') : 'none')
  await page.screenshot({ path: 'test-results/closeout-diag-normal.png', fullPage: true })

  // Agent 视图
  const agentErrors = []
  page.removeAllListeners('pageerror')
  page.removeAllListeners('console')
  page.on('pageerror', (error) => agentErrors.push(`pageerror: ${error.message}`))
  page.on('console', (msg) => { if (msg.type() === 'error') agentErrors.push(`console: ${msg.text()}`) })
  await page.goto('http://127.0.0.1:5173/?agent=codex&project=disposable-mvp-sample', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(8000)
  const surface = await page.locator('[data-testid="agent-context-surface"]').count()
  const surfaceText = surface ? (await page.locator('[data-testid="agent-context-surface"]').innerText()).slice(0, 300) : 'MISSING'
  console.log('agent surface:', surface, surfaceText.replace(/\n/g, ' | '))
  console.log('agent errors:', agentErrors.length ? agentErrors.slice(0, 10).join('\n') : 'none')
  await page.screenshot({ path: 'test-results/closeout-diag-agent.png', fullPage: true })
} finally {
  await browser.close()
}

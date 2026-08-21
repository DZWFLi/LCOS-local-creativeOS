// B7: 从选中节点到发出 Run 的核心动作数（目标 ≤3：选中 → 写指令 → Ctrl+Enter 发送）
// 发送后立即取消新建的 Run，避免占用执行器。
import { chromium } from '@playwright/test'

const projectId = process.env.LCOS_PROBE_PROJECT ?? 'disposable-mvp-sample'
const preferredNode = process.env.LCOS_PROBE_NODE ?? 'view-brief'
const prompt = '快速分析 brief.md 的第一句话说了什么（探针测试，取消即可）。'

const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } })
  const errors = []
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(`console: ${msg.text()}`) })
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith('/runs')) {
      errors.push(`POST /runs body=${request.postData()?.slice(0, 400) ?? '(none)'}`)
    }
  })
  page.on('response', (response) => {
    if (response.status() >= 400) {
      if (response.url().endsWith('/runs')) {
        void response.text().then((text) => errors.push(`http${response.status()}: ${response.url()} body=${text.slice(0, 500)}`)).catch(() => undefined)
      } else {
        errors.push(`http${response.status()}: ${response.url()}`)
      }
    }
  })

  await page.goto(`http://127.0.0.1:5173/?project=${projectId}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-node-id]', { timeout: 20_000 })

  await page.waitForSelector(`[data-node-id="${preferredNode}"]`, { timeout: 20_000 })
  const nodeId = preferredNode

  let steps = 0
  await page.locator(`[data-node-id="${nodeId}"]`).first().click({ delay: 30 }) // 动作 1：选中
  steps += 1
  await page.waitForSelector('[data-testid="selection-composer-input"]', { timeout: 10_000 })
  await page.focus('[data-testid="selection-composer-input"]') // 动作 2：聚焦输入
  steps += 1
  await page.fill('[data-testid="selection-composer-input"]', prompt)
  const inputValue = await page.inputValue('[data-testid="selection-composer-input"]')
  const sendEnabled = await page.locator('[data-testid="selection-composer"] button.selection-send').isEnabled().catch(() => false)
  await page.click('[data-testid="selection-composer"] button.selection-send') // 动作 3：发送
  steps += 1

  await page.waitForTimeout(4000)
  const runs = await page.evaluate(async (project) => {
    const res = await fetch(`/api/local-core/v1/projects/${project}/runs?limit=20`)
    return await res.json()
  }, projectId)
  const matched = (runs?.value ?? []).find((item) => item?.run?.instruction === prompt)
  const runId = matched?.run?.id ?? null
  const recentRuns = (runs?.value ?? []).slice(0, 3).map((item) => `${item.run.id}:${item.run.status}`).join(', ')
  console.log(`recent runs: ${recentRuns}`)

  let cancelResult = 'not_attempted'
  if (runId) {
    cancelResult = await page.evaluate(async (id) => {
      const res = await fetch(`/api/local-core/v1/runs/${id}/cancel`, { method: 'POST' })
      return res.ok ? 'cancel_ok' : `cancel_http_${res.status}`
    }, runId)
  }

  console.log(JSON.stringify({
    ok: steps <= 3 && runId !== null,
    steps,
    nodeId,
    runId,
    runCreated: runId !== null,
    inputValue,
    sendEnabled,
    cancelResult,
    errors: errors.length ? errors : 'none',
  }, null, 2))
} finally {
  await browser.close()
}

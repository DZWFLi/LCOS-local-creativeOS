/**
 * C3 probe: ?agent=codex Agent Surface — sync badge, context sections,
 * Codex proposal chip accept loop. Requires running dev:open stack.
 */
import { readFileSync } from 'node:fs'
import { chromium } from '@playwright/test'

const projectId = 'disposable-mvp-sample'
const token = readFileSync('.codex-runtime/local-core-token', 'utf8').trim()
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 860 } })
  await page.goto(`http://127.0.0.1:5173/?agent=codex&project=${projectId}`, { waitUntil: 'networkidle' })
  await page.waitForSelector('[data-testid="agent-context-surface"]', { timeout: 20_000 })
  const versionText = await page.locator('[data-testid="agent-context-surface"] code').textContent()
  console.log(`surface visible, version=${versionText}`)

  // 造一条 Codex 提案（模拟 Codex 建议加一个参考）
  const graph = await (await fetch(`http://127.0.0.1:43121/projects/${projectId}/graph`, {
    headers: { authorization: `Bearer ${token}` },
  })).json()
  const scopeId = graph.value.scopes[0].id
  const viewA = graph.value.artifactViews[0].id
  const viewB = graph.value.artifactViews[1].id
  const active = await (await fetch(`http://127.0.0.1:43121/projects/${projectId}/active-context`, {
    headers: { authorization: `Bearer ${token}` },
  })).json()
  await fetch(`http://127.0.0.1:43121/projects/${projectId}/active-context`, {
    method: 'PUT',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ scopeId, selectedViewIds: [viewA], pinnedContextIds: [], excludedContextIds: [] }),
  })
  const after = await (await fetch(`http://127.0.0.1:43121/projects/${projectId}/active-context`, {
    headers: { authorization: `Bearer ${token}` },
  })).json()
  const proposal = await (await fetch(`http://127.0.0.1:43121/projects/${projectId}/context-proposals`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ baseContextVersion: after.value.version, addViewIds: [viewB], removeViewIds: [], reason: '探针：建议把第二份参考加入本次 Context' }),
  })).json()
  console.log(`proposal created: ${proposal.value.proposalId}`)

  // 等提案 chip 出现并接受
  await page.waitForSelector(`[data-testid="agent-proposal-${proposal.value.proposalId}"]`, { timeout: 12_000 })
  await page.click(`[data-testid="agent-proposal-${proposal.value.proposalId}"] button:has-text("接受")`)
  await page.waitForTimeout(1_000)
  const badge = await page.locator('[data-testid="agent-context-surface"] .agent-sync-badge span').textContent()
  console.log(`after accept: sync="${badge}"`)
  const contextCount = await page.locator('[data-testid="agent-context-surface"] dd:has-text("2")').count()
  console.log(`context count shown: ${contextCount > 0}`)
  console.log('AGENT_SURFACE_PROBE_OK')
} finally {
  await browser.close()
}

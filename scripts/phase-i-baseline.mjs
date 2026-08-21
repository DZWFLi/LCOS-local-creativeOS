/**
 * Phase I 资源基线（Measurement First）。
 *
 * 测量项：
 * 1. LCOS 常驻进程内存（Core / Bridge / Web，按命令行匹配 node 进程）
 * 2. Golden 项目 graph 大小与拉取耗时
 * 3. 浏览器加载耗时（domcontentloaded → canvas 就绪）
 * 4. 预览生成耗时（POST previews → preview-records ready）
 * 5. 检索耗时（GET /projects/:id/search-documents 或 artifact search）
 *
 * 输出：docs/audit/PHASE_I_BASELINE_<date>.md（本脚本只打印 JSON，写文档由执行者落盘）。
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { performance } from 'node:perf_hooks'

const token = readFileSync('.codex-runtime/local-core-token', 'utf8').trim()
const base = 'http://127.0.0.1:43121'
const web = 'http://127.0.0.1:5173'
const projectId = process.argv[2] ?? 'project-lcos-golden-gate-2026-08-17314dfd'
const headers = { authorization: `Bearer ${token}` }

const out = {}

// 1) 进程内存（Windows：PowerShell 按命令行匹配）
try {
  const ps = execFileSync('powershell', [
    '-NoProfile', '-Command',
    `Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | Where-Object { $_.CommandLine -match 'local-core|light-bridge|vite' } | ForEach-Object { [PSCustomObject]@{ Pid = $_.ProcessId; Cmd = $_.CommandLine; WS = (Get-Process -Id $_.ProcessId).WorkingSet64 } } | ConvertTo-Json`,
  ], { encoding: 'utf8' })
  const rows = JSON.parse(ps)
  const list = Array.isArray(rows) ? rows : [rows]
  out.processes = list.map((row) => ({
    pid: row.Pid,
    kind: row.Cmd.includes('local-core') ? 'core' : row.Cmd.includes('light-bridge') ? 'bridge' : row.Cmd.includes('vite') ? 'web' : 'other',
    workingSetMB: Math.round((row.WS ?? 0) / 1024 / 1024),
  }))
} catch {
  out.processes = []
}

// 2) graph 大小与拉取耗时
{
  const started = performance.now()
  const res = await fetch(`${base}/projects/${projectId}/graph`, { headers })
  const bytes = (await res.arrayBuffer()).byteLength
  out.graph = { status: res.status, bytes, fetchMs: Math.round((performance.now() - started) * 10) / 10 }
}

// 3) 浏览器加载（headless Chromium 由调用方提供路径；这里用 Playwright）
try {
  const { chromium } = await import('playwright')
  const started = performance.now()
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto(`${web}/?project=${projectId}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  const domReady = performance.now()
  await page.waitForSelector('[data-testid="canvas"]', { timeout: 30000 })
  const canvasReady = performance.now()
  await page.waitForTimeout(2500)
  const expand = page.locator('button[aria-label="展开小地图"]')
  if (await expand.count()) await expand.first().click()
  await page.waitForTimeout(300)
  const minimapCount = await page.locator('[data-testid="project-minimap"]').getAttribute('data-node-count').catch(() => null)
  out.browser = {
    domContentLoadedMs: Math.round((domReady - started) * 10) / 10,
    canvasReadyMs: Math.round((canvasReady - started) * 10) / 10,
    nodeCount: Number(minimapCount ?? 0),
  }
  await browser.close()
} catch (error) {
  out.browser = { error: String(error).slice(0, 200) }
}

// 4) 预览生成耗时（取一个文本 revision 触发 thumbnail）
try {
  const graph = await (await fetch(`${base}/projects/${projectId}/graph`, { headers })).json()
  const revision = graph.value.artifactRevisions.find((rev) => String(rev.id).includes('golden-text-01'))
  if (revision) {
    const started = performance.now()
    await fetch(`${base}/projects/${projectId}/previews`, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ revisionId: String(revision.id), previewProfile: 'thumbnail' }),
    })
    let status = 'pending'
    for (let i = 0; i < 20; i++) {
      await new Promise((resolve) => setTimeout(resolve, 250))
      const records = await (await fetch(`${base}/projects/${projectId}/preview-records`, { headers })).json()
      const mine = records.value?.find((record) => String(record.revisionId) === String(revision.id) && record.previewProfile === 'thumbnail')
      if (mine && (mine.status === 'ready' || mine.status === 'failed' || mine.status === 'unsupported')) { status = mine.status; break }
    }
    out.preview = { status, generateMs: Math.round((performance.now() - started) * 10) / 10 }
  } else {
    out.preview = { status: 'no-revision' }
  }
} catch (error) {
  out.preview = { error: String(error).slice(0, 200) }
}

// 5) 检索耗时（artifact search）
try {
  const started = performance.now()
  const res = await fetch(`${base}/projects/${projectId}/artifacts/search?q=${encodeURIComponent('项目资料')}&limit=5`, { headers })
  const body = await res.json()
  out.search = { status: res.status, hits: body.value?.length ?? 0, ms: Math.round((performance.now() - started) * 10) / 10 }
} catch (error) {
  out.search = { error: String(error).slice(0, 200) }
}

console.log(JSON.stringify(out, null, 2))

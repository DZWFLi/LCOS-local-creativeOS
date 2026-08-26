/**
 * canvas-organizer —— LCOS agentlet 参考实现（Reachback 全链路闭环）。
 *
 * env 契约（宿主 spawn 时注入；任何 agentlet 都拿到同一套）：
 *   LCOS_CORE_URL / LCOS_AGENTLET_TOKEN / LCOS_SESSION_ID
 *   LCOS_PROJECT_ID / LCOS_SCOPE_ID / LCOS_AGENTLET_INSTRUCTION
 *
 * 闭环步骤：
 *   1. Reachback 读：POST /space/ls（虚拟路径 + L1 扫描头）
 *   2. Reachback 读：POST /space/read（全文 + full-read lease）
 *   3. Reachback 写：POST /curation/text（带 sessionId → CAS 守卫 + ChangeSet 归因 actor=agent/<sessionId>）
 *
 * 换 agent 时把本目录换成新 manifest（command 指向 codex/claude 等 CLI 的 ACP 入口），
 * env 契约与本文件的写法即对接说明书（详见 system_prompt.md）。
 */

const base = process.env.LCOS_CORE_URL
const token = process.env.LCOS_AGENTLET_TOKEN
const projectId = process.env.LCOS_PROJECT_ID
const scopeId = process.env.LCOS_SCOPE_ID
const sessionId = process.env.LCOS_SESSION_ID
const instruction = process.env.LCOS_AGENTLET_INSTRUCTION

if (!base || !projectId || !scopeId || !sessionId) {
  console.error('missing required env: LCOS_CORE_URL / LCOS_PROJECT_ID / LCOS_SCOPE_ID / LCOS_SESSION_ID')
  process.exit(1)
}

const headers = {
  'content-type': 'application/json',
  ...(token ? { authorization: `Bearer ${token}` } : {}),
}

async function call(method, path, body) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const json = await response.json().catch(() => ({}))
  if (!response.ok || json.ok === false) {
    throw new Error(`${method} ${path} -> ${response.status}: ${json?.error?.message ?? 'unknown'}`)
  }
  return json.value ?? json
}

function log(...args) {
  console.log(`[canvas-organizer]`, ...args)
}

// ---- 1. Reachback 读：列出项目节点（虚拟命名空间） ----
const ls = await call('POST', `/projects/${encodeURIComponent(projectId)}/space/ls`, {})
log(`space: ${ls.items.length} nodes`)

// ---- 2. Reachback 读：读前三个节点全文（记 full-read lease） ----
const readNodes = []
for (const item of ls.items.slice(0, 3)) {
  const read = await call('POST', `/projects/${encodeURIComponent(projectId)}/space/read`, {
    path: item.path,
    sessionId,
  })
  readNodes.push({ title: item.title, revisionId: read.revisionId })
  log(`read: ${item.title}`)
}

// ---- 3. 布局：graph 视图坐标 → 摘要节点放现有内容右下（layout-recipes 网格步距） ----
const graph = await call('GET', `/projects/${encodeURIComponent(projectId)}/graph`)
const views = graph.artifactViews ?? []
const maxX = views.reduce((acc, view) => Math.max(acc, view.position?.x ?? 0), 0)
const maxY = views.reduce((acc, view) => Math.max(acc, view.position?.y ?? 0), 0)

// ---- 4. Reachback 写：产出摘要节点（label 1-5 词 + content 分离，node-labeling 规范） ----
const title = '现场摘要'
const body = [
  `# 现场摘要`,
  '',
  `canvas-organizer 于 ${new Date().toISOString()} 经 Reachback 巡检本项目。`,
  '',
  `- 节点总数：${ls.items.length}`,
  `- 抽样细读：${readNodes.map((node) => node.title).join('、')}${readNodes.length === 0 ? '（空项目）' : ''}`,
  ...(instruction ? ['', `本次指令：${instruction}`] : []),
  '',
  '写回经 CAS 守卫通道；本节点可在 change-sets 中按 sessionId 追溯归因。',
  '',
].join('\n')

const created = await call('POST', `/projects/${encodeURIComponent(projectId)}/curation/text`, {
  scopeId,
  title,
  body,
  sessionId,
  x: maxX + 230,
  y: maxY + 150,
})
log(`created: ${created.viewId} (${title})`)

// ---- 5. 结构化产出（宿主/后续 agent 可消费） ----
console.log(JSON.stringify({
  ok: true,
  agentlet: 'canvas-organizer',
  sessionId,
  nodesSeen: ls.items.length,
  nodesRead: readNodes.length,
  createdViewId: created.viewId,
}))

import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import readline from 'node:readline'

const root = process.cwd()
const failures = []
const checks = []
const pass = (name, detail = '') => checks.push({ name, ok: true, detail })
const fail = (name, detail) => { checks.push({ name, ok: false, detail }); failures.push(`${name}: ${detail}`) }

function source(relative) {
  const path = resolve(root, relative)
  if (!existsSync(path)) {
    fail(`存在 ${relative}`, '文件缺失')
    return ''
  }
  return readFileSync(path, 'utf8')
}

function createMcpClient(role) {
  const child = spawn(process.execPath, [resolve(root, 'tools/lcos-agent/mcp-server.mjs')], {
    cwd: root,
    env: { ...process.env, LCOS_MCP_ROLE: role },
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  })
  const pending = new Map()
  let sequence = 0
  const output = readline.createInterface({ input: child.stdout, crlfDelay: Infinity })
  let stderr = ''
  child.stderr.on('data', (chunk) => { stderr += chunk.toString() })
  output.on('line', (line) => {
    let message
    try { message = JSON.parse(line) } catch { return }
    const waiter = pending.get(message.id)
    if (!waiter) return
    pending.delete(message.id)
    if (message.error) waiter.reject(new Error(message.error.message))
    else waiter.resolve(message.result)
  })
  const call = (method, params = {}) => new Promise((resolveResult, rejectResult) => {
    sequence += 1
    const id = sequence
    const timeout = setTimeout(() => {
      pending.delete(id)
      rejectResult(new Error(`${role} MCP ${method} 超时。${stderr ? ` stderr=${stderr.trim()}` : ''}`))
    }, 5_000)
    pending.set(id, {
      resolve: (result) => { clearTimeout(timeout); resolveResult(result) },
      reject: (error) => { clearTimeout(timeout); rejectResult(error) },
    })
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`)
  })
  return { child, call, stderr: () => stderr }
}

async function listTools(role) {
  const client = createMcpClient(role)
  try {
    const initialized = await client.call('initialize', {
      protocolVersion: '2025-11-25',
      capabilities: {},
      clientInfo: { name: 'lcos-gatef-plus-validator', version: '1.0.0' },
    })
    const listed = await client.call('tools/list')
    return { initialized, tools: listed.tools ?? [] }
  } finally {
    client.child.kill('SIGTERM')
  }
}

const executorExpected = new Set([
  'get_lcos_run_context',
  'claim_lcos_run', 'start_lcos_run', 'heartbeat_lcos_run', 'fail_lcos_run', 'request_lcos_user_input',
  'get_lcos_task', 'submit_lcos_result',
])

const canvasExpected = new Set([
  'get_lcos_active_context', 'watch_lcos_active_context',
  'select_lcos_views', 'focus_lcos_views',
  'create_lcos_relation', 'open_lcos_preview',
])

const conversationExpected = new Set([
  'import_lcos_conversation',
  'list_lcos_conversations', 'get_lcos_conversation', 'search_lcos_conversations',
  'read_lcos_conversation_messages', 'list_lcos_conversation_sections',
  'read_lcos_conversation_section', 'annotate_lcos_conversation_section',
  'pin_lcos_conversation_message',
])

const agent = await listTools('agent')
const executor = await listTools('executor')
const agentNames = new Set(agent.tools.map((item) => item.name))
const executorNames = new Set(executor.tools.map((item) => item.name))

if (agent.initialized.serverInfo?.name === 'local-creative-os') pass('Agent MCP 身份', 'local-creative-os')
else fail('Agent MCP 身份', JSON.stringify(agent.initialized.serverInfo))
if (executor.initialized.serverInfo?.name === 'lcos-executor') pass('Executor MCP 身份', 'lcos-executor')
else fail('Executor MCP 身份', JSON.stringify(executor.initialized.serverInfo))

const missingExecutor = [...executorExpected].filter((name) => !executorNames.has(name))
const extraExecutor = [...executorNames].filter((name) => !executorExpected.has(name))
if (missingExecutor.length === 0 && extraExecutor.length === 0) pass('Executor 工具面冻结', `${executorNames.size} 个工具`)
else fail('Executor 工具面冻结', `缺少=${missingExecutor.join(',') || '-'} 多余=${extraExecutor.join(',') || '-'}`)


const missingCanvas = [...canvasExpected].filter((name) => !agentNames.has(name))
if (missingCanvas.length === 0) pass('Agent Canvas 工具面', `${canvasExpected.size} 个观察与安全动作齐全`)
else fail('Agent Canvas 工具面', `缺少=${missingCanvas.join(',')}`)

const missingConversation = [...conversationExpected].filter((name) => !agentNames.has(name))
if (missingConversation.length === 0) pass('Agent Conversation 工具面', `${conversationExpected.size} 个关键工具齐全`)
else fail('Agent Conversation 工具面', `缺少=${missingConversation.join(',')}`)

const overlap = [...executorNames].filter((name) => agentNames.has(name))
if (overlap.length === 0) pass('MCP 角色零重叠')
else fail('MCP 角色零重叠', overlap.join(','))

for (const name of conversationExpected) {
  if (executorNames.has(name)) fail('Executor 不暴露 Conversation', name)
}
if (!failures.some((item) => item.startsWith('Executor 不暴露 Conversation'))) pass('Executor 不暴露 Conversation')

const bridgeApi = source('tools/light-bridge-kernel/src/lcos_bridge/transport/http_api.py')
if (!/['"]\/mcp['"]/.test(bridgeApi) && !/MCP/i.test(bridgeApi)) pass('Light Bridge 仅 REST')
else fail('Light Bridge 仅 REST', 'http_api.py 仍出现 MCP 路由或公开面。')

const localCoreIndex = source('apps/local-core/src/index.ts')
if (localCoreIndex.includes('RestBridgeRuntimeClient') && !localCoreIndex.includes('BridgeMcp')) pass('Local Core 使用 Bridge REST Adapter')
else fail('Local Core 使用 Bridge REST Adapter', '未检测到唯一 REST Adapter。')

const repoText = [
  source('tools/lcos-agent/mcp-server.mjs'),
  source('tools/lcos-agent/mcp-executor-server.mjs'),
  source('tools/lcos-agent/lib/client.mjs'),
].join('\n')
if (!repoText.includes('LCOS_BRIDGE_URL')) pass('MCP 不直接读取 Bridge URL')
else fail('MCP 不直接读取 Bridge URL', 'MCP 仍直接依赖 Bridge。')

const metadata = source('apps/local-core/src/metadata-repository.ts')
if (/schemaVersion\(\).*?18/s.test(metadata) || metadata.includes('return 18')) pass('Local Core Schema v18')
else fail('Local Core Schema v18', '未检测到 v18。')
for (const table of ['conversation_sessions', 'conversation_messages', 'conversation_file_references', 'conversation_sections', 'conversation_section_annotations', 'conversation_messages_fts']) {
  if (!metadata.includes(table)) fail('Conversation Schema', `缺少 ${table}`)
}
if (!failures.some((item) => item.startsWith('Conversation Schema'))) pass('Conversation Schema', 'L0/L1/L2/FTS 表存在')

const conversationService = source('apps/local-core/src/conversation-import-service.ts')
for (const capability of ['fts5', 'sqlite-vec', '/api/embed', 'stream', 'exportConversation']) {
  if (!conversationService.toLowerCase().includes(capability.toLowerCase())) fail('Conversation Service 能力', `缺少 ${capability}`)
}
if (!failures.some((item) => item.startsWith('Conversation Service 能力'))) pass('Conversation Service 能力', 'L0–L3 代码路径齐全')

const webDialog = source('apps/web/src/features/conversations/ConversationContextDialog.tsx')
for (const label of ['时间线', '大纲', '关系图', '语义索引', '手动', '导入诊断']) {
  if (!webDialog.includes(label)) fail('Conversation UI', `缺少 ${label}`)
}
if (!failures.some((item) => item.startsWith('Conversation UI'))) pass('Conversation UI', '导入/时间线/大纲/搜索/索引入口存在')

const installer = source('scripts/install-lcos-codex-mcp.mjs')
if (installer.includes("removeManaged(codex, 'ai_bridge', { exactLegacy: true })") && installer.includes('looksExactLegacyAiBridge')) pass('ai_bridge 精确退役')
else fail('ai_bridge 精确退役', '缺少签名判断或精确清理。')
if (installer.includes('startup_timeout_sec') && installer.includes('tool_timeout_sec')) pass('Codex MCP 超时配置')
else fail('Codex MCP 超时配置', '安装器未写入 startup/tool timeout。')


const activeContext = source('apps/local-core/src/active-context-store.ts')
if (activeContext.includes('offscreenClusters') && activeContext.includes('visibleViewIds')) pass('Canvas 视口外摘要')
else fail('Canvas 视口外摘要', 'ActiveContext 未投影 offscreenClusters。')
if (activeContext.includes('recentChanges') && activeContext.includes('#deriveRecentChanges')) pass('Canvas 最近变化摘要')
else fail('Canvas 最近变化摘要', 'ActiveContext 未投影最近选择、上下文、目标和视口变化。')
if (source('apps/local-core/src/routes/canvas.ts').includes('canvas-observation') && source('packages/contracts/src/index.ts').includes('CanvasObservationV1')) pass('Canvas Observation 合同')
else fail('Canvas Observation 合同', '缺少结构化 Snapshot 的视觉补充。')

const conversationContracts = source('packages/contracts/src/conversations.ts')
if (conversationContracts.includes('ContextImportSourceV0') && conversationContracts.includes('ConversationImportDiagnosticV1')) pass('Context Import 合同与诊断')
else fail('Context Import 合同与诊断', '缺少统一来源或持久诊断合同。')
if (conversationService.includes('ANNOTATION_USER_LOCKED') && conversationService.includes('embeddingInputHash')) pass('L2 用户优先与 L3 增量索引')
else fail('L2 用户优先与 L3 增量索引', '用户标注保护或增量 Hash 缺失。')

const watchdogLib = source('tools/codex-orchestrator/watch-lib.mjs')
const watchdog = source('tools/codex-orchestrator/watch.mjs')
if (watchdogLib.includes('ProjectTaskPool') && watchdogLib.includes('TaskTimeoutError') && watchdog.includes('LCOS_ORCHESTRATOR_RUNNER_TIMEOUT_MS')) pass('Watchdog 并发与超时护栏')
else fail('Watchdog 并发与超时护栏', '缺少项目串行、跨项目并发或超时释放。')

const packageJson = JSON.parse(source('package.json'))
for (const script of ['lcos:mcp', 'lcos:mcp:executor', 'lcos:install-sqlite-vec', 'smoke:conversation', 'smoke:conversation-semantic', 'smoke:schema-v18', 'smoke:watchdog', 'smoke:lcosproj-browser', 'check:gatef-plus']) {
  if (!packageJson.scripts?.[script]) fail('Package Scripts', `缺少 ${script}`)
}
if (!failures.some((item) => item.startsWith('Package Scripts'))) pass('Package Scripts', 'Gate F Plus 脚本齐全')

const summary = { ok: failures.length === 0, checks, agentToolCount: agentNames.size, executorToolCount: executorNames.size }
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
if (failures.length > 0) process.exitCode = 1

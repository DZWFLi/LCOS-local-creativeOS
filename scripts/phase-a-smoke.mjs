/**
 * Phase A 真实 HTTP 冒烟：Runtime Registry / Focus / Reveal / Local Intelligence / Title Policy。
 * 起一个临时 Core（独立 DB、独立端口、独立 registry），建项目，逐项验证。
 */
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'

const PORT = 43131
const BASE = `http://127.0.0.1:${PORT}`
const TOKEN = 'smoke-token'
const HEADERS = { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' }

function assert(condition, message) {
  if (!condition) throw new Error(`ASSERT FAILED: ${message}`)
}

async function call(path, { method = 'GET', body } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: HEADERS,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const json = await response.json().catch(() => ({ ok: false }))
  return { status: response.status, json }
}

async function waitForHealth(timeoutMs = 20_000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(1_500) })
      if (response.ok) return
    } catch { /* retry */ }
    await new Promise((resolve) => setTimeout(resolve, 350))
  }
  throw new Error('Core did not become healthy in time.')
}

const root = await mkdtemp(join(tmpdir(), 'lcos-phase-a-smoke-'))
const core = spawn(process.execPath, ['dist/index.js'], {
  cwd: join(process.cwd(), 'apps/local-core'),
  stdio: ['ignore', 'ignore', 'ignore'],
  windowsHide: true,
  env: {
    ...process.env,
    LOCAL_CORE_DB_PATH: join(root, 'smoke.sqlite'),
    LOCAL_CORE_TEST_PORT: String(PORT),
    LOCAL_CORE_API_TOKEN: TOKEN,
    LOCAL_CORE_DISABLE_MVP_SAMPLE: '1',
    LCOS_RUNTIME_REGISTRY: join(root, 'runtime-registry.json'),
  },
})

try {
  await waitForHealth()

  // 1. 建项目（真实 rootPath）
  const projectRoot = join(root, 'project-a')
  await mkdir(projectRoot, { recursive: true })
  const created = await call('/projects', {
    method: 'POST',
    body: { name: 'Alpha', intent: 'open', rootPath: projectRoot },
  })
  assert(created.status >= 200 && created.status < 300 && created.json?.ok === true, `create project: ${created.status} ${JSON.stringify(created.json)}`)
  const projectId = created.json.value.id
  console.log(`✓ project created: ${projectId}`)

  // 2. Focus signal
  const focus = await call(`/runtime/projects/${projectId}/focus`, { method: 'POST' })
  assert(focus.status === 200 && focus.json?.ok === true, `focus: ${focus.status}`)
  assert(focus.json.value.lastFocusedProjectId === projectId, 'focus registry id')
  console.log('✓ focus signal recorded')

  // 3. Registry GET
  const registry = await call('/runtime/registry')
  assert(registry.status === 200 && registry.json?.value?.recentProjects?.[0]?.projectId === projectId, 'registry recent')
  console.log('✓ runtime registry served')

  // 4. Pinned capture target
  const pinned = await call('/runtime/registry/capture-target', { method: 'POST', body: { projectId } })
  assert(pinned.json?.value?.pinnedCaptureProjectId === projectId, 'pinned target')
  const unpinned = await call('/runtime/registry/capture-target', { method: 'POST', body: { projectId: null } })
  assert(unpinned.json?.value?.pinnedCaptureProjectId === undefined, 'unpinned target')
  console.log('✓ pinned capture target toggles')

  // 5. Reveal（只校验安全错误路径；真实 explorer 弹出不做自动断言）
  const revealMissing = await call(`/projects/does-not-exist/reveal`, { method: 'POST' })
  assert(revealMissing.status === 404, `reveal missing project -> 404, got ${revealMissing.status}`)
  const reveal = await call(`/projects/${projectId}/reveal`, { method: 'POST' })
  assert(reveal.status === 200 && reveal.json?.ok === true, `reveal: ${reveal.status} ${JSON.stringify(reveal.json)}`)
  console.log('✓ reveal endpoint (registered root only)')

  // 6. Title Policy：用户改名 → manual；Agent 后续不得静默覆盖（Core 记录 mode）
  const renamed = await call(`/entities/project/${projectId}/title`, {
    method: 'POST',
    body: { title: 'PortaSplit 二轮', mode: 'manual', generatedBy: 'user' },
  })
  assert(renamed.status === 200 && renamed.json?.ok === true, `rename: ${renamed.status} ${JSON.stringify(renamed.json)}`)
  const graphAfter = await call(`/projects/${projectId}/graph`)
  assert(graphAfter.json?.value?.project?.name === 'PortaSplit 二轮', 'project title updated in Core')
  const badMode = await call(`/entities/project/${projectId}/title`, {
    method: 'POST',
    body: { title: 'X', mode: 'silent' },
  })
  assert(badMode.status === 400, `bad mode -> 400, got ${badMode.status}`)
  console.log('✓ title policy (auto/manual, validation)')

  // 7. Local Intelligence（Ollama 未装 → unavailable 但 200）
  const intelligence = await call('/runtime/local-intelligence')
  assert(intelligence.status === 200 && intelligence.json?.ok === true, `intelligence: ${intelligence.status}`)
  console.log(`✓ local intelligence probe: ${JSON.stringify(intelligence.json.value)}`)

  // 8. 重启持久化：重开 registry 文件（Core 同实例内不重复测；文件已落盘）
  const registryFile = join(root, 'runtime-registry.json')
  const persisted = JSON.parse(await readRegistry(registryFile))
  assert(persisted.recentProjects?.[0]?.projectId === projectId, 'registry persisted to disk')
  console.log('✓ registry persisted on disk')

  console.log('PHASE A SMOKE: ALL PASS')
} finally {
  core.kill('SIGTERM')
  await new Promise((resolve) => setTimeout(resolve, 500))
  await rm(root, { recursive: true, force: true, maxRetries: 3 }).catch(() => { /* best effort */ })
}

async function readRegistry(path) {
  const { readFile } = await import('node:fs/promises')
  return readFile(path, 'utf8')
}

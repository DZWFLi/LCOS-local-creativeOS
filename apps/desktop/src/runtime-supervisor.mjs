import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, statfsSync, cpSync, rmSync } from 'node:fs'
import { createConnection } from 'node:net'
import { join, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { utilityProcess } from 'electron'

const CORE_PORT = 43121
const BRIDGE_PORT = 43122
const RESTART_WINDOW_MS = 5 * 60_000
const MAX_RESTARTS = 3

function sleep(ms) { return new Promise((resolvePromise) => setTimeout(resolvePromise, ms)) }

/**
 * Electron utilityProcess.fork already boots a Node-capable Utility Process.
 * ELECTRON_RUN_AS_NODE makes the packaged executable parse Chromium's
 * --type=utility arguments as Node CLI options before the child can start.
 */
export function utilityEnvironment(overrides = {}) {
  const env = { ...process.env, ...overrides }
  delete env.ELECTRON_RUN_AS_NODE
  return env
}

async function portFree(port) {
  return new Promise((resolvePromise) => {
    const socket = createConnection({ host: '127.0.0.1', port })
    socket.once('connect', () => { socket.destroy(); resolvePromise(false) })
    socket.once('error', () => resolvePromise(true))
    socket.setTimeout(400, () => { socket.destroy(); resolvePromise(true) })
  })
}

async function waitFor(url, timeoutMs = 20_000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(800) })
      if (response.status < 500) return true
    } catch {}
    await sleep(250)
  }
  return false
}

function ensureToken(file) {
  if (existsSync(file)) {
    const existing = readFileSync(file, 'utf8').trim()
    if (existing) return existing
  }
  const value = randomBytes(32).toString('base64url')
  writeFileSync(file, `${value}\n`, { encoding: 'utf8', mode: 0o600 })
  return value
}

function storageFreeBytes(path) {
  try {
    const stats = statfsSync(path)
    return Number(stats.bavail) * Number(stats.bsize)
  } catch {
    return undefined
  }
}

function formatBytes(value) {
  if (!Number.isFinite(value)) return 'unknown'
  const gib = value / (1024 ** 3)
  return `${gib.toFixed(gib >= 10 ? 0 : 1)} GiB`
}

export class DesktopRuntimeSupervisor {
  constructor({ runtimeBundleRoot, userDataRoot, logRoot, onStatus }) {
    this.runtimeBundleRoot = resolve(runtimeBundleRoot)
    this.userDataRoot = resolve(userDataRoot)
    this.logRoot = resolve(logRoot)
    this.onStatus = onStatus ?? (() => {})
    this.children = new Map()
    this.restartHistory = new Map()
    this.stopping = false
    mkdirSync(this.userDataRoot, { recursive: true })
    mkdirSync(this.logRoot, { recursive: true })
    this.tokenFile = join(this.userDataRoot, 'local-core-token')
    this.token = ensureToken(this.tokenFile)
    this.codexIntegrationMarker = join(this.userDataRoot, 'codex-integration.json')
    this.codexIntegrationRoot = join(this.userDataRoot, 'codex-integration')
  }

  status() {
    return {
      core: this.children.get('core')?.pid ? 'running' : 'stopped',
      bridge: this.children.get('bridge')?.pid ? 'running' : 'stopped',
      orchestrator: this.children.get('orchestrator')?.pid ? 'running' : 'stopped',
      codexIntegration: existsSync(this.codexIntegrationMarker) ? 'configured' : 'needs_setup',
      freeBytes: storageFreeBytes(this.userDataRoot),
      corePort: CORE_PORT,
      bridgePort: BRIDGE_PORT,
      runtimeRoot: this.userDataRoot,
    }
  }

  emitStatus() { this.onStatus(this.status()) }

  log(name, message) {
    appendFileSync(join(this.logRoot, `${name}.log`), `[${new Date().toISOString()}] ${message}\n`, 'utf8')
  }

  recordRestart(name) {
    const now = Date.now()
    const history = (this.restartHistory.get(name) ?? []).filter((stamp) => now - stamp < RESTART_WINDOW_MS)
    history.push(now)
    this.restartHistory.set(name, history)
    return history.length <= MAX_RESTARTS
  }

  attachUtility(name, child, startAgain) {
    this.children.set(name, child)
    child.stdout?.on('data', (chunk) => this.log(name, chunk.toString('utf8').trimEnd()))
    child.stderr?.on('data', (chunk) => this.log(name, chunk.toString('utf8').trimEnd()))
    child.on?.('error', (error) => this.log(name, `process error: ${error instanceof Error ? error.message : String(error)}`))
    child.once('exit', (code) => {
      if (this.children.get(name) === child) this.children.delete(name)
      this.log(name, `exit code=${String(code)}`)
      this.emitStatus()
      if (!this.stopping && this.recordRestart(name)) setTimeout(() => void startAgain(), 800)
    })
    this.emitStatus()
  }

  attachSpawn(name, child, startAgain) {
    this.children.set(name, child)
    child.stdout?.on('data', (chunk) => this.log(name, chunk.toString('utf8').trimEnd()))
    child.stderr?.on('data', (chunk) => this.log(name, chunk.toString('utf8').trimEnd()))
    child.on?.('error', (error) => this.log(name, `process error: ${error instanceof Error ? error.message : String(error)}`))
    child.once('exit', (code) => {
      if (this.children.get(name) === child) this.children.delete(name)
      this.log(name, `exit code=${String(code)}`)
      this.emitStatus()
      if (!this.stopping && this.recordRestart(name)) setTimeout(() => void startAgain(), 800)
    })
    this.emitStatus()
  }

  assertStorageAvailable() {
    const freeBytes = storageFreeBytes(this.userDataRoot)
    const minimum = 512 * 1024 * 1024
    if (freeBytes !== undefined && freeBytes < minimum) {
      throw new Error(`LCOS 所在磁盘剩余空间不足（${formatBytes(freeBytes)}）。请至少释放 512 MiB 后重试，避免数据库/预览缓存写入失败。`)
    }
  }

  async assertPortsAvailable() {
    const busy = []
    if (!await portFree(CORE_PORT)) busy.push(CORE_PORT)
    if (!await portFree(BRIDGE_PORT)) busy.push(BRIDGE_PORT)
    if (busy.length) throw new Error(`LCOS Runtime 端口已被占用：${busy.join(', ')}。请先退出旧 LCOS/开发栈后重试。`)
  }

  startBridge = async () => {
    if (this.stopping || this.children.has('bridge')) return
    const runtimeRoot = join(this.userDataRoot, 'bridge')
    mkdirSync(runtimeRoot, { recursive: true })
    const bundledExe = join(this.runtimeBundleRoot, 'bridge', 'lcos-bridge', process.platform === 'win32' ? 'lcos-bridge.exe' : 'lcos-bridge')
    let child
    if (existsSync(bundledExe)) {
      child = spawn(bundledExe, ['serve', '--host', '127.0.0.1', '--port', String(BRIDGE_PORT), '--runtime-root', runtimeRoot], {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, LCOS_BRIDGE_RUNTIME_ROOT: runtimeRoot },
      })
    } else {
      const sourceRoot = join(this.runtimeBundleRoot, 'bridge-source', 'src')
      const python = process.env.LCOS_LIGHT_BRIDGE_PYTHON ?? (process.platform === 'win32' ? 'python.exe' : 'python3')
      child = spawn(python, ['-m', 'lcos_bridge', 'serve', '--host', '127.0.0.1', '--port', String(BRIDGE_PORT), '--runtime-root', runtimeRoot], {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, PYTHONPATH: sourceRoot, LCOS_BRIDGE_RUNTIME_ROOT: runtimeRoot },
      })
    }
    this.attachSpawn('bridge', child, this.startBridge)
  }

  startCore = async () => {
    if (this.stopping || this.children.has('core')) return
    const entry = join(this.runtimeBundleRoot, 'local-core', 'dist', 'index.js')
    if (!existsSync(entry)) throw new Error(`Local Core desktop bundle missing: ${entry}`)
    const dataRoot = join(this.userDataRoot, 'core')
    mkdirSync(dataRoot, { recursive: true })
    const child = utilityProcess.fork(entry, [], {
      serviceName: 'LCOS Local Core',
      stdio: 'pipe',
      cwd: this.runtimeBundleRoot,
      env: utilityEnvironment({
        LOCAL_CORE_API_TOKEN: this.token,
        LOCAL_CORE_DB_PATH: join(dataRoot, 'metadata.sqlite'),
        LOCAL_CORE_MVP_SAMPLE_ROOT: join(dataRoot, 'mvp-sample-project'),
        LCOS_BRIDGE_URL: `http://127.0.0.1:${BRIDGE_PORT}`,
        LCOS_CORE_TOKEN_FILE: this.tokenFile,
        LCOS_REPO_ROOT: this.runtimeBundleRoot,
        LCOS_OCR_RUNTIME_DIR: join(this.userDataRoot, 'ocr'),
      }),
    })
    this.attachUtility('core', child, this.startCore)
  }

  startOrchestrator = async () => {
    if (this.stopping || this.children.has('orchestrator')) return
    if (!existsSync(this.codexIntegrationMarker)) {
      this.log('orchestrator', 'Codex integration not configured; waiting for desktop setup')
      this.emitStatus()
      return
    }
    const entry = join(this.runtimeBundleRoot, 'tools', 'codex-orchestrator', 'watch.mjs')
    if (!existsSync(entry)) {
      this.log('orchestrator', 'not packaged; agent execution remains external')
      return
    }
    const stateRoot = join(this.userDataRoot, 'orchestrator')
    mkdirSync(stateRoot, { recursive: true })
    const child = utilityProcess.fork(entry, [], {
      serviceName: 'LCOS Codex Orchestrator',
      stdio: 'pipe',
      cwd: this.runtimeBundleRoot,
      env: utilityEnvironment({
        LCOS_ORCHESTRATOR_REPO: this.runtimeBundleRoot,
        LCOS_CORE_URL: `http://127.0.0.1:${CORE_PORT}`,
        LCOS_BRIDGE_URL: `http://127.0.0.1:${BRIDGE_PORT}`,
        LCOS_CORE_TOKEN_FILE: this.tokenFile,
        LCOS_ORCHESTRATOR_STATE_DIR: stateRoot,
        LCOS_ORCHESTRATOR_LOCK: join(stateRoot, 'watch.lock'),
      }),
    })
    this.attachUtility('orchestrator', child, this.startOrchestrator)
  }

  codexIntegrationNeedsRefresh() {
    if (!existsSync(this.codexIntegrationMarker)) return false
    try {
      const marker = JSON.parse(readFileSync(this.codexIntegrationMarker, 'utf8'))
      return marker?.runtimeBundleRoot !== this.runtimeBundleRoot
    } catch {
      return true
    }
  }

  refreshCodexIntegrationFiles() {
    const sources = [
      [join(this.runtimeBundleRoot, 'tools', 'lcos-agent'), join(this.codexIntegrationRoot, 'tools', 'lcos-agent')],
      [join(this.runtimeBundleRoot, 'packages', 'skills'), join(this.codexIntegrationRoot, 'packages', 'skills')],
    ]
    for (const [source, destination] of sources) {
      if (!existsSync(source)) throw new Error(`Codex integration bundle missing: ${source}`)
      // Managed copies must mirror the packaged runtime exactly. Leaving old files
      // behind across app updates can expose stale MCP launchers / skills.
      rmSync(destination, { recursive: true, force: true })
      mkdirSync(destination, { recursive: true })
      cpSync(source, destination, { recursive: true, force: true })
    }
  }

  runUtilityOnce(name, entry, extraEnv = {}) {
    return new Promise((resolvePromise, reject) => {
      if (!existsSync(entry)) {
        reject(new Error(`${name} script missing: ${entry}`))
        return
      }
      const child = utilityProcess.fork(entry, [], {
        serviceName: `LCOS ${name}`,
        stdio: 'pipe',
        cwd: this.runtimeBundleRoot,
        env: utilityEnvironment({
          LCOS_REPO_ROOT: this.runtimeBundleRoot,
          LCOS_CORE_URL: `http://127.0.0.1:${CORE_PORT}`,
          LCOS_BRIDGE_URL: `http://127.0.0.1:${BRIDGE_PORT}`,
          LCOS_CORE_TOKEN_FILE: this.tokenFile,
          ...extraEnv,
        }),
      })
      let output = ''
      let reportedCompletion = false
      let settled = false
      child.on('message', (message) => {
        if (message?.type === 'lcos:utility-complete' && message?.name === name) {
          reportedCompletion = true
          settled = true
          resolvePromise(output)
          child.kill()
        }
      })
      child.stdout?.on('data', (chunk) => {
        const text = chunk.toString('utf8')
        output = `${output}${text}`.slice(-1_000_000)
        this.log('codex-setup', text.trimEnd())
      })
      child.stderr?.on('data', (chunk) => {
        const text = chunk.toString('utf8')
        output = `${output}${text}`.slice(-1_000_000)
        this.log('codex-setup', text.trimEnd())
      })
      child.once('exit', (code) => {
        if (settled) return
        settled = true
        // Electron 43 on Windows may report code 1 after an ESM utility script
        // has naturally completed. Only an explicit, script-owned completion
        // message may override that unreliable exit code; real failures still
        // reject because they never emit the message.
        if (code === 0 || reportedCompletion) resolvePromise(output)
        else reject(new Error(`${name} failed with code ${String(code)}.
${output.slice(-4000)}`))
      })
    })
  }

  async installCodexIntegration() {
    this.refreshCodexIntegrationFiles()
    const skillInstaller = join(this.runtimeBundleRoot, 'scripts', 'install-lcos-codex-skill.mjs')
    const mcpInstaller = join(this.runtimeBundleRoot, 'scripts', 'install-lcos-codex-mcp.mjs')
    const integrationEnv = { LCOS_REPO_ROOT: this.codexIntegrationRoot }
    await this.runUtilityOnce('Codex skill setup', skillInstaller, integrationEnv)
    await this.runUtilityOnce('Codex MCP setup', mcpInstaller, integrationEnv)
    writeFileSync(this.codexIntegrationMarker, `${JSON.stringify({
      schemaVersion: 1,
      configuredAt: new Date().toISOString(),
      runtimeBundleRoot: this.runtimeBundleRoot,
    }, null, 2)}
`, 'utf8')
    this.emitStatus()
    await this.startOrchestrator()
    return this.status()
  }

  async start() {
    this.stopping = false
    this.assertStorageAvailable()
    await this.assertPortsAvailable()
    await this.startBridge()
    if (!await waitFor(`http://127.0.0.1:${BRIDGE_PORT}/health`, 20_000)) throw new Error('LCOS Light Bridge 启动超时。')
    await this.startCore()
    if (!await waitFor(`http://127.0.0.1:${CORE_PORT}/health`, 25_000)) throw new Error('LCOS Local Core 启动超时。')
    if (existsSync(this.codexIntegrationMarker)) {
      if (this.codexIntegrationNeedsRefresh()) await this.installCodexIntegration()
      else this.refreshCodexIntegrationFiles()
    }
    await this.startOrchestrator()
    this.emitStatus()
    return this.status()
  }

  async stop() {
    this.stopping = true
    for (const [name, child] of [...this.children.entries()].reverse()) {
      this.children.delete(name)
      try { child.kill?.() } catch {}
    }
    await sleep(400)
    this.emitStatus()
  }

  async restart() {
    await this.stop()
    this.restartHistory.clear()
    this.stopping = false
    return this.start()
  }
}

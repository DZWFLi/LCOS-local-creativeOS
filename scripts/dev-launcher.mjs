import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, openSync, closeSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { delimiter, join } from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import http from 'node:http'

const WEB_PORT = 5173
const CORE_PORT = 43121
const BRIDGE_PORT = 43122
const WEB_URL = `http://127.0.0.1:${WEB_PORT}/`
const CORE_HEALTH_URL = `http://127.0.0.1:${CORE_PORT}/health`
const BRIDGE_HEALTH_URL = `http://127.0.0.1:${BRIDGE_PORT}/health`
const RUNTIME_DIR = join(process.cwd(), '.codex-runtime')
const STATE_FILE = join(RUNTIME_DIR, 'dev-launcher-state.json')
const LEGACY_DEV_STACK_PID_FILE = join(RUNTIME_DIR, 'dev-stack.pid')
const PROFILE_DIR = join(RUNTIME_DIR, 'browser-profile')
const LOG_DIR = join(RUNTIME_DIR, 'logs')
const TARGET_FILE = join(process.cwd(), '.dev-launcher', 'target.json')
const BRIDGE_RUNTIME_ROOT = join(RUNTIME_DIR, 'bridge')
const RESTART_WINDOW_MS = 5 * 60_000
const MAX_RESTARTS_PER_WINDOW = 3
const HEALTH_CHECK_MS = 5_000
const HEALTH_FAIL_LIMIT = 3

const command = process.argv[2] ?? 'status'

function ensureRuntimeDir() {
  mkdirSync(RUNTIME_DIR, { recursive: true })
  mkdirSync(LOG_DIR, { recursive: true })
}

function readJson(file) {
  if (!existsSync(file)) return null
  try { return JSON.parse(readFileSync(file, 'utf8')) } catch { return null }
}

function writeState(state) {
  ensureRuntimeDir()
  writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`, 'utf8')
}

function clearState() {
  if (existsSync(STATE_FILE)) rmSync(STATE_FILE, { force: true })
}

function run(commandName, args, options = {}) {
  const result = spawnSync(commandName, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    windowsHide: true,
    ...options,
  })
  if (result.error) return { ok: false, stdout: '', stderr: result.error.message, status: 1 }
  return { ok: result.status === 0, stdout: result.stdout ?? '', stderr: result.stderr ?? '', status: result.status ?? 0 }
}

function gitText(args) {
  return run('git', args).stdout.trim()
}

function gitInfo() {
  return {
    branch: gitText(['branch', '--show-current']) || '(detached)',
    commit: gitText(['rev-parse', '--short', 'HEAD']),
    status: gitText(['status', '--short']),
  }
}

function packageVersion() {
  const pkg = readJson(join(process.cwd(), 'package.json'))
  return pkg?.version ?? 'unknown'
}

function isPidRunning(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false
  if (process.platform === 'win32') {
    const result = run('powershell.exe', ['-NoProfile', '-Command', `Get-Process -Id ${pid} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id`])
    return result.stdout.trim() === String(pid)
  }
  try { process.kill(pid, 0); return true } catch { return false }
}

function portOwners(ports = [WEB_PORT, CORE_PORT, BRIDGE_PORT]) {
  if (process.platform !== 'win32') return []
  const portList = ports.join(',')
  const ps = [
    `$ports=@(${portList});`,
    'Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |',
    'Where-Object { $ports -contains $_.LocalPort } |',
    'Select-Object LocalAddress,LocalPort,OwningProcess | ConvertTo-Json -Compress',
  ].join(' ')
  const result = run('powershell.exe', ['-NoProfile', '-Command', ps])
  const raw = result.stdout.trim()
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : [parsed]
  } catch {
    return []
  }
}

function lcosListenerPids(ports = [WEB_PORT, CORE_PORT, BRIDGE_PORT]) {
  if (process.platform !== 'win32') return []
  const portList = ports.join(',')
  const ps = [
    `$ports=@(${portList});`,
    'Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |',
    'Where-Object { $ports -contains $_.LocalPort } |',
    'Select-Object -ExpandProperty OwningProcess -Unique |',
    'ForEach-Object {',
    '  $p=Get-CimInstance Win32_Process -Filter "ProcessId=$_" -ErrorAction SilentlyContinue;',
    '  if ($p -and $p.CommandLine -and ($p.CommandLine -match "lcos_bridge" -or $p.CommandLine -match "vite" -or $p.CommandLine -match "dist/index.js")) { $p.ProcessId }',
    '}',
  ].join(' ')
  const result = run('powershell.exe', ['-NoProfile', '-Command', ps])
  const raw = result.stdout.trim()
  if (!raw) return []
  return raw.split(/\r?\n/).map((line) => Number(line.trim())).filter((pid) => Number.isInteger(pid))
}

function killTree(pid) {
  if (!isPidRunning(pid)) return
  if (process.platform === 'win32') {
    spawnSync('taskkill.exe', ['/pid', String(pid), '/t', '/f'], { stdio: 'ignore', windowsHide: true })
    return
  }
  try { process.kill(pid, 'SIGTERM') } catch {}
}

function ownedPidsFromState() {
  const state = readJson(STATE_FILE)
  const pids = []
  if (state && state.cwd === process.cwd()) {
    pids.push(state.browserPid, state.webPid, state.corePid, state.bridgePid)
  }
  if (existsSync(LEGACY_DEV_STACK_PID_FILE)) {
    const pid = Number(readFileSync(LEGACY_DEV_STACK_PID_FILE, 'utf8').trim())
    if (Number.isInteger(pid)) pids.push(pid)
  }
  return pids.filter((pid) => Number.isInteger(pid))
}

function descendantPids(rootPids) {
  const roots = new Set(rootPids.filter((pid) => Number.isInteger(pid)))
  if (roots.size === 0 || process.platform !== 'win32') return []
  const result = run('powershell.exe', ['-NoProfile', '-Command', [
    'Get-CimInstance Win32_Process |',
    'Select-Object ProcessId,ParentProcessId |',
    'ConvertTo-Json -Compress',
  ].join(' ')])
  const raw = result.stdout.trim()
  if (!raw) return []
  let rows = []
  try {
    const parsed = JSON.parse(raw)
    rows = Array.isArray(parsed) ? parsed : [parsed]
  } catch {
    return []
  }
  const childrenByParent = new Map()
  for (const row of rows) {
    const parent = Number(row.ParentProcessId)
    const pid = Number(row.ProcessId)
    if (!Number.isInteger(parent) || !Number.isInteger(pid)) continue
    const list = childrenByParent.get(parent) ?? []
    list.push(pid)
    childrenByParent.set(parent, list)
  }
  const all = new Set()
  const stack = [...roots]
  while (stack.length) {
    const pid = stack.pop()
    if (!Number.isInteger(pid) || all.has(pid)) continue
    all.add(pid)
    for (const child of childrenByParent.get(pid) ?? []) stack.push(child)
  }
  return [...all]
}

function ownedPidSet() {
  const roots = ownedPidsFromState()
  return new Set([...roots, ...descendantPids(roots)])
}

function stopOwned({ quiet = false } = {}) {
  const announce = (pid, source) => {
    if (!quiet && Number.isInteger(pid)) console.log(`- stop pid=${pid} (${source})`)
  }
  for (const pid of lcosListenerPids()) {
    announce(pid, 'port listener')
    killTree(pid)
  }
  const pids = ownedPidsFromState()
  for (const pid of pids) {
    announce(pid, 'state')
    killTree(pid)
  }
  spawnSync('powershell.exe', ['-NoProfile', '-Command', 'Start-Sleep -Milliseconds 1200'], {
    stdio: 'ignore',
    windowsHide: true,
  })
  for (const pid of lcosListenerPids()) {
    announce(pid, 'port listener (second pass)')
    killTree(pid)
  }
  clearState()
  if (existsSync(LEGACY_DEV_STACK_PID_FILE)) rmSync(LEGACY_DEV_STACK_PID_FILE, { force: true })
  if (!quiet) console.log('✓ LCOS dev stack stopped')
}

function assertPortsFreeOrOwned() {
  const owners = portOwners()
  if (owners.length === 0) return
  const owned = ownedPidSet()
  const foreign = owners.filter((owner) => !owned.has(Number(owner.OwningProcess)))
  if (foreign.length > 0) {
    console.error('Port conflict: refusing to kill non-LCOS processes.')
    for (const owner of foreign) console.error(`- ${owner.LocalAddress}:${owner.LocalPort} pid=${owner.OwningProcess}`)
    process.exit(1)
  }
  stopOwned({ quiet: true })
}

function spawnLogged(script, logName, environment = {}) {
  const npmCli = process.env.npm_execpath
  const npmCommand = npmCli ? process.execPath : process.platform === 'win32' ? 'npm.cmd' : 'npm'
  const args = npmCli ? [npmCli, 'run', script] : ['run', script]
  const outFd = openSync(join(LOG_DIR, `${logName}.out.log`), 'a')
  const errFd = openSync(join(LOG_DIR, `${logName}.err.log`), 'a')
  const child = spawn(npmCommand, args, {
    cwd: process.cwd(),
    stdio: ['ignore', outFd, errFd],
    windowsHide: true,
    env: { ...process.env, ...environment },
  })
  child.once('exit', () => {
    try { closeSync(outFd) } catch {}
    try { closeSync(errFd) } catch {}
  })
  return child
}

function spawnBridge(environment = {}) {
  const candidates = process.platform === 'win32'
    ? [
        join(process.cwd(), 'tools/light-bridge-kernel/.venv/Scripts/python.exe'),
        join(process.cwd(), 'tools/light-bridge-kernel/.codex-runtime/bridge-test-venv/Scripts/python.exe'),
      ]
    : [join(process.cwd(), 'tools/light-bridge-kernel/.venv/bin/python')]
  const python = process.env.LCOS_LIGHT_BRIDGE_PYTHON
    ?? candidates.find((candidate) => existsSync(candidate))
    ?? (process.platform === 'win32' ? 'python.exe' : 'python3')
  const sourceRoot = join(process.cwd(), 'tools/light-bridge-kernel/src')
  const outFd = openSync(join(LOG_DIR, 'bridge.out.log'), 'a')
  const errFd = openSync(join(LOG_DIR, 'bridge.err.log'), 'a')
  const child = spawn(python, [
    '-m', 'lcos_bridge', 'serve',
    '--host', '127.0.0.1',
    '--port', String(BRIDGE_PORT),
  ], {
    cwd: process.cwd(),
    stdio: ['ignore', outFd, errFd],
    windowsHide: true,
    env: {
      ...process.env,
      ...environment,
      PYTHONPATH: [sourceRoot, process.env.PYTHONPATH].filter(Boolean).join(delimiter),
      LCOS_BRIDGE_RUNTIME_ROOT: BRIDGE_RUNTIME_ROOT,
    },
  })
  child.once('exit', () => {
    try { closeSync(outFd) } catch {}
    try { closeSync(errFd) } catch {}
  })
  return child
}

function bridgePythonProbe() {
  const result = run('python', ['-c', 'import lcos_bridge; print("ok")'], {
    env: {
      ...process.env,
      PYTHONPATH: [join(process.cwd(), 'tools/light-bridge-kernel/src'), process.env.PYTHONPATH].filter(Boolean).join(delimiter),
    },
  })
  return result.ok
}

function waitForHttp(url, timeoutMs = 20_000) {
  const started = Date.now()
  return new Promise((resolve, reject) => {
    const attempt = async () => {
      if (await probeHttp(url, 1_500)) {
        resolve(true)
        return
      }
      if (Date.now() - started > timeoutMs) reject(new Error(`Timed out waiting for ${url}`))
      else setTimeout(attempt, 350)
    }
    attempt()
  })
}

function probeHttp(url, timeoutMs = 1_500) {
  return new Promise((resolve) => {
    const request = http.get(url, { timeout: timeoutMs }, (response) => {
      response.resume()
      request.destroy()
      resolve(response.statusCode !== undefined && response.statusCode < 500)
    })
    request.on('timeout', () => { request.destroy(); resolve(false) })
    request.on('error', () => resolve(false))
  })
}

function browserCandidates() {
  if (process.platform !== 'win32') return ['google-chrome', 'chromium', 'microsoft-edge']
  const env = process.env
  return [
    join(env['PROGRAMFILES'] ?? 'C:\\Program Files', 'Google\\Chrome\\Application\\chrome.exe'),
    join(env['PROGRAMFILES(X86)'] ?? 'C:\\Program Files (x86)', 'Google\\Chrome\\Application\\chrome.exe'),
    join(env.LOCALAPPDATA ?? '', 'Google\\Chrome\\Application\\chrome.exe'),
    join(env['PROGRAMFILES'] ?? 'C:\\Program Files', 'Microsoft\\Edge\\Application\\msedge.exe'),
    join(env['PROGRAMFILES(X86)'] ?? 'C:\\Program Files (x86)', 'Microsoft\\Edge\\Application\\msedge.exe'),
  ].filter(Boolean)
}

function findBrowser() {
  for (const candidate of browserCandidates()) {
    if (process.platform === 'win32' ? existsSync(candidate) : run('which', [candidate]).ok) return candidate
  }
  return null
}

function openBrowserWindow() {
  const browser = findBrowser()
  if (!browser) {
    console.log(`Open manually: ${WEB_URL}`)
    return null
  }
  mkdirSync(PROFILE_DIR, { recursive: true })
  return spawn(browser, [
    `--app=${WEB_URL}`,
    `--user-data-dir=${PROFILE_DIR}`,
    '--no-first-run',
    '--disable-default-apps',
    '--new-window',
  ], {
    cwd: process.cwd(),
    stdio: 'ignore',
    detached: false,
    windowsHide: false,
  })
}

function printStatus() {
  const info = gitInfo()
  const version = packageVersion()
  const owners = portOwners()
  const state = readJson(STATE_FILE)
  const target = readJson(TARGET_FILE)
  console.log(`Local Creative OS v${version}`)
  if (target) {
    console.log(`Target version: ${target.version ?? '(unspecified)'}`)
    console.log(`Target worktree: ${target.repoPath ?? process.cwd()}`)
    console.log(`Expected branch: ${target.expectedBranch ?? '(unspecified)'}`)
    if (target.lastTestedCommit) console.log(`Last tested commit: ${target.lastTestedCommit}`)
  }
  console.log(`Branch: ${info.branch}`)
  console.log(`Commit: ${info.commit}`)
  console.log(`Working tree: ${info.status ? 'dirty' : 'clean'}`)
  if (info.status) console.log(info.status)
  console.log(`State file: ${existsSync(STATE_FILE) ? STATE_FILE : '(none)'}`)
  console.log(`Recorded PIDs: ${state ? JSON.stringify({ launcherPid: state.launcherPid, corePid: state.corePid, webPid: state.webPid, bridgePid: state.bridgePid, browserPid: state.browserPid }) : '(none)'}`)
  console.log('Ports:')
  for (const port of [WEB_PORT, CORE_PORT, BRIDGE_PORT]) {
    const owner = owners.find((item) => Number(item.LocalPort) === port)
    console.log(`- ${port}: ${owner ? `LISTEN pid=${owner.OwningProcess}` : 'free'}`)
  }
  if (state) {
    console.log(`Restarts: core=${state.coreRestarts ?? 0} web=${state.webRestarts ?? 0} bridge=${state.bridgeRestarts ?? 0}`)
  }
  console.log(`Logs: ${LOG_DIR}`)
}

function assertTarget(info) {
  const target = readJson(TARGET_FILE)
  if (!target) return
  const normalizePath = (value) => value.replaceAll('\\', '/').replace(/\/+$/, '').toLowerCase()
  const expectedPath = target.repoPath ? normalizePath(target.repoPath) : null
  if (expectedPath && normalizePath(process.cwd()) !== expectedPath) {
    console.error('Refusing to start from unexpected target worktree.')
    console.error(`Expected: ${target.repoPath}`)
    console.error(`Actual:   ${process.cwd()}`)
    process.exit(1)
  }
  if (target.expectedBranch && info.branch !== target.expectedBranch) {
    console.error('Refusing to start from unexpected branch.')
    console.error(`Expected: ${target.expectedBranch}`)
    console.error(`Actual:   ${info.branch}`)
    process.exit(1)
  }
  if (target.lastTestedCommit && target.lastTestedCommit !== info.commit) {
    console.log(`NEW BUILD: ${target.lastTestedCommit} -> ${info.commit}`)
  }
}

let stopping = false

async function open() {
  ensureRuntimeDir()
  const info = gitInfo()
  const version = packageVersion()
  console.log(`Local Creative OS v${version}`)
  console.log(`Branch: ${info.branch}`)
  console.log(`Commit: ${info.commit}`)
  console.log(`Working tree: ${info.status ? 'dirty' : 'clean'}`)
  assertTarget(info)
  if (info.status) {
    console.error('Refusing to start from a dirty worktree.')
    console.error(info.status)
    process.exit(1)
  }
  assertPortsFreeOrOwned()
  if (!bridgePythonProbe()) {
    console.error('✗ Light Bridge kernel is not importable.')
    console.error('  Expected venv: tools/light-bridge-kernel/.venv/Scripts/python.exe')
    console.error('  Or set LCOS_LIGHT_BRIDGE_PYTHON to a python with lcos_bridge installed.')
    process.exit(1)
  }
  const localCoreToken = randomBytes(32).toString('base64url')
  const environment = { LOCAL_CORE_API_TOKEN: localCoreToken }
  const state = {
    cwd: process.cwd(),
    version,
    branch: info.branch,
    commit: info.commit,
    startedAt: new Date().toISOString(),
    launcherPid: process.pid,
    corePid: null,
    webPid: null,
    bridgePid: null,
    browserPid: null,
    coreRestarts: 0,
    webRestarts: 0,
    bridgeRestarts: 0,
    lastCoreRestartAt: null,
    lastWebRestartAt: null,
    lastBridgeRestartAt: null,
  }
  writeState(state)

  const services = {
    core: { healthUrl: CORE_HEALTH_URL, pid: null, pendingRestart: false, manualStop: false, restarts: 0, restartWindowStart: 0, healthFails: 0, lastRestartAt: null },
    web: { healthUrl: WEB_URL, pid: null, pendingRestart: false, manualStop: false, restarts: 0, restartWindowStart: 0, healthFails: 0, lastRestartAt: null },
    bridge: { healthUrl: BRIDGE_HEALTH_URL, pid: null, pendingRestart: false, manualStop: false, restarts: 0, restartWindowStart: 0, healthFails: 0, lastRestartAt: null },
  }
  const spawners = {
    core: () => spawnLogged('dev:local-core', 'local-core', environment),
    web: () => spawnLogged('dev:web', 'web', environment),
    bridge: () => spawnBridge(environment),
  }

  function refreshState() {
    state.corePid = services.core.pid
    state.webPid = services.web.pid
    state.bridgePid = services.bridge.pid
    state.coreRestarts = services.core.restarts
    state.webRestarts = services.web.restarts
    state.bridgeRestarts = services.bridge.restarts
    state.lastCoreRestartAt = services.core.lastRestartAt
    state.lastWebRestartAt = services.web.lastRestartAt
    state.lastBridgeRestartAt = services.bridge.lastRestartAt
    writeState(state)
  }

  function startService(name) {
    const service = services[name]
    const child = spawners[name]()
    service.pid = child.pid ?? null
    service.pendingRestart = false
    service.manualStop = false
    child.once('error', (error) => {
      console.error(`✗ ${name} failed to start: ${error.message}`)
      scheduleRestart(name)
    })
    child.once('exit', (code, signal) => {
      service.pid = null
      refreshState()
      if (stopping || service.manualStop) return
      console.log(`⚠ ${name} exited (code=${code ?? 'null'} signal=${signal ?? 'null'})`)
      scheduleRestart(name)
    })
    refreshState()
    return child
  }

  function scheduleRestart(name) {
    const service = services[name]
    if (service.pendingRestart || stopping) return
    service.pendingRestart = true
    const now = Date.now()
    if (service.restartWindowStart === 0) service.restartWindowStart = now
    if (now - service.restartWindowStart > RESTART_WINDOW_MS) {
      service.restartWindowStart = now
      service.restarts = 0
    }
    service.restarts += 1
    if (service.restarts > MAX_RESTARTS_PER_WINDOW) {
      console.error(`✗ ${name} restarted ${service.restarts} times in 5 minutes; stopping the runtime host.`)
      stopping = true
      stopOwned({ quiet: true })
      process.exit(1)
    }
    service.lastRestartAt = new Date().toISOString()
    refreshState()
    const delay = service.restarts === 1 ? 500 : 2_000 * (service.restarts - 1)
    setTimeout(() => startService(name), delay)
  }

  function stopService(name) {
    const service = services[name]
    if (service.pid !== null) {
      service.manualStop = true
      killTree(service.pid)
      service.pid = null
      refreshState()
    }
    const port = name === 'core' ? CORE_PORT : name === 'bridge' ? BRIDGE_PORT : WEB_PORT
    for (const pid of lcosListenerPids([port])) killTree(pid)
  }

  function stopAll() {
    stopping = true
    stopOwned({ quiet: true })
  }

  startService('bridge')
  startService('core')
  startService('web')
  try {
    await waitForHttp(BRIDGE_HEALTH_URL, 30_000)
    console.log(`✓ Light Bridge ${BRIDGE_PORT}`)
    await waitForHttp(CORE_HEALTH_URL, 30_000)
    console.log(`✓ Local Core ${CORE_PORT}`)
    await waitForHttp(WEB_URL, 30_000)
    console.log(`✓ Web ${WEB_PORT}`)
  } catch (error) {
    console.error(error.message)
    stopAll()
    process.exit(1)
  }

  const browser = openBrowserWindow()
  if (browser?.pid) {
    state.browserPid = browser.pid
    writeState(state)
    console.log(`✓ Browser opened pid=${browser.pid}`)
    console.log('GUI closed = Web stops only. Local Core + Bridge keep running; npm run dev:stop stops all.')
    browser.once('exit', () => {
      if (state.browserPid === browser.pid) state.browserPid = null
      stopService('web')
      writeState(state)
      console.log('GUI closed; Web stopped. Local Core + Bridge still running.')
    })
  } else {
    console.log('Browser executable not found; services remain running until npm run dev:stop.')
  }

  setInterval(async () => {
    for (const name of ['core', 'bridge', 'web']) {
      const service = services[name]
      if (service.pid === null) continue
      const healthy = await probeHttp(service.healthUrl, 1_500)
      if (healthy) {
        service.healthFails = 0
        continue
      }
      service.healthFails += 1
      console.warn(`⚠ ${name} health probe failed ${service.healthFails}/${HEALTH_FAIL_LIMIT}`)
      if (service.healthFails >= HEALTH_FAIL_LIMIT) {
        service.healthFails = 0
        console.error(`✗ ${name} unhealthy; restarting`)
        stopService(name)
        scheduleRestart(name)
      }
    }
  }, HEALTH_CHECK_MS)

  const shutdown = () => { stopAll(); process.exit(0) }
  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)
}

if (command === 'open') await open()
else if (command === 'stop') stopOwned()
else if (command === 'status') printStatus()
else if (command === 'target') {
  const info = gitInfo()
  assertTarget(info)
  printStatus()
}
else {
  console.error('Usage: npm run dev:open | dev:stop | dev:status | dev:target')
  process.exit(1)
}

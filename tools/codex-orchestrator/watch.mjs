#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { mkdir, open, readFile, rm, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import readline from 'node:readline'
import { ProjectTaskPool, TaskTimeoutError, nextRetryDelay, parseRunnerMarker, readJsonFile, runWithTimeout, writeJsonAtomic } from './watch-lib.mjs'

const repoRoot = resolve(process.env.LCOS_ORCHESTRATOR_REPO || resolve(import.meta.dirname, '..', '..'))
const tokenFile = resolve(process.env.LCOS_CORE_TOKEN_FILE || join(repoRoot, '.codex-runtime', 'local-core-token'))
const coreUrl = process.env.LCOS_CORE_URL || 'http://127.0.0.1:43121'
const bridgeUrl = process.env.LCOS_BRIDGE_URL || 'http://127.0.0.1:43122'
const stateDir = resolve(process.env.LCOS_ORCHESTRATOR_STATE_DIR || join(repoRoot, '.codex-runtime'))
const stateFile = join(stateDir, 'orchestrator-state-v2.json')
const lockFile = resolve(process.env.LCOS_ORCHESTRATOR_LOCK || join(tmpdir(), 'lcos-orchestrator-v2.lock'))
const runner = resolve(repoRoot, 'tools', 'codex-orchestrator', 'run-codex-task.mjs')
const once = process.env.LCOS_ORCHESTRATOR_ONCE === '1'
const dryRun = process.env.LCOS_ORCHESTRATOR_DRY_RUN === '1'
const minPollMs = Math.max(500, Number(process.env.LCOS_ORCHESTRATOR_MIN_POLL_MS || 2_000))
const maxPollMs = Math.max(minPollMs, Number(process.env.LCOS_ORCHESTRATOR_MAX_POLL_MS || 60_000))
const runnerTimeoutMs = Math.max(30_000, Number(process.env.LCOS_ORCHESTRATOR_RUNNER_TIMEOUT_MS || 30 * 60_000))
const concurrency = Math.max(1, Math.min(8, Number(process.env.LCOS_ORCHESTRATOR_CONCURRENCY || 2)))
const maxAttempts = Math.max(1, Math.min(10, Number(process.env.LCOS_ORCHESTRATOR_MAX_ATTEMPTS || 3)))
const selectedProjects = new Set(String(process.env.LCOS_ORCHESTRATOR_PROJECTS || '').split(',').map((item) => item.trim()).filter(Boolean))
const pool = new ProjectTaskPool(concurrency)
let stopping = false
let lockHandle
let state = await readJsonFile(stateFile, { version: 2, runs: {} })
if (!state || state.version !== 2 || typeof state.runs !== 'object') state = { version: 2, runs: {} }

function log(message, details) {
  const suffix = details === undefined ? '' : ` ${typeof details === 'string' ? details : JSON.stringify(details)}`
  process.stdout.write(`[${new Date().toISOString()}] ${message}${suffix}\n`)
}
function resolveCodex() {
  if (process.env.CODEX_BIN) return process.env.CODEX_BIN
  if (process.platform === 'win32') {
    const base = process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'OpenAI', 'Codex', 'bin') : undefined
    if (base && existsSync(base)) {
      const candidates = readdirSync(base, { withFileTypes: true })
        .filter((item) => item.isDirectory() && existsSync(join(base, item.name, 'codex.exe')))
        .map((item) => join(base, item.name, 'codex.exe'))
        .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)
      if (candidates[0]) return candidates[0]
    }
    const found = spawnSync('where.exe', ['codex'], { encoding: 'utf8', windowsHide: true })
    const first = String(found.stdout || '').split(/\r?\n/).find(Boolean)
    if (first) return first.trim()
  }
  return 'codex'
}
const codexBin = resolveCodex()

async function acquireLock() {
  try {
    lockHandle = await open(lockFile, 'wx')
    await lockHandle.writeFile(String(process.pid))
  } catch (error) {
    if (error?.code !== 'EEXIST') throw error
    const pid = Number((await readFile(lockFile, 'utf8').catch(() => '0')).trim())
    let alive = false
    if (pid > 0) { try { process.kill(pid, 0); alive = true } catch {} }
    if (alive) throw new Error(`已有 LCOS 看门狗在运行（PID ${pid}）。`)
    await rm(lockFile, { force: true })
    return acquireLock()
  }
}
async function releaseLock() {
  try { await lockHandle?.close() } catch {}
  await rm(lockFile, { force: true }).catch(() => {})
}
async function token() {
  const value = (await readFile(tokenFile, 'utf8')).trim()
  if (!value) throw new Error(`Local Core token 为空：${tokenFile}`)
  return value
}
async function core(path, init = {}) {
  const { timeoutMs = 15_000, ...requestInit } = init
  const response = await fetch(new URL(path, coreUrl), {
    ...requestInit,
    headers: { accept: 'application/json', authorization: `Bearer ${await token()}`, ...(requestInit.headers || {}) },
    signal: AbortSignal.timeout(timeoutMs),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok || body?.ok === false) throw new Error(body?.error?.message || `${init.method || 'GET'} ${path} failed with HTTP ${response.status}`)
  return body?.value ?? body
}
async function bridge(path, init = {}) {
  const { timeoutMs = 10_000, ...requestInit } = init
  const response = await fetch(new URL(path, bridgeUrl), {
    ...requestInit,
    headers: { accept: 'application/json', ...(requestInit.headers || {}) },
    signal: AbortSignal.timeout(timeoutMs),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok || body?.ok === false) throw new Error(body?.error?.message || `${init.method || 'GET'} ${path} failed with HTTP ${response.status}`)
  return body?.value ?? body
}
async function providerBinding(projectId) {
  try { return await core(`/projects/${encodeURIComponent(projectId)}/provider-sessions/codex`) }
  catch { return undefined }
}
function sessionBusy(sessionId) {
  if (!sessionId || !/^[A-Za-z0-9-]+$/.test(sessionId)) return false
  try {
    const base = join(homedir(), '.codex', 'sessions')
    if (!existsSync(base)) return false
    const stack = [base]
    while (stack.length) {
      const dir = stack.pop()
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name)
        if (entry.isDirectory()) stack.push(path)
        else if (entry.isFile() && entry.name.includes(sessionId) && Date.now() - statSync(path).mtimeMs < 10_000) return true
      }
    }
  } catch {}
  return false
}
async function dispatchPlan(project) {
  const binding = await providerBinding(project.id)
  const sessions = binding?.status === 'active' && binding.externalSessionId
    ? [{ sessionId: binding.externalSessionId, busy: sessionBusy(binding.externalSessionId) }]
    : []
  return core('/runtime/codex-dispatch-plan', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ projectId: project.id, sessions }),
  })
}
async function saveBinding(projectId, sessionId, runId, status = 'active', failureCount = 0) {
  if (!sessionId) return
  await core(`/projects/${encodeURIComponent(projectId)}/provider-sessions/codex`, {
    method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
      externalSessionId: sessionId, origin: 'watchdog', status, lastSeenAt: new Date().toISOString(), lastRunId: runId, failureCount,
    }),
  })
}
function runState(runId) {
  return state.runs[runId] || { attempts: 0, nextAttemptAt: 0, lastOutcome: 'never' }
}
async function updateRunState(runId, patch) {
  state.runs[runId] = { ...runState(runId), ...patch, updatedAt: new Date().toISOString() }
  const keys = Object.keys(state.runs)
  if (keys.length > 2_000) {
    keys.sort((a, b) => String(state.runs[b]?.updatedAt || '').localeCompare(String(state.runs[a]?.updatedAt || '')))
    for (const key of keys.slice(1_000)) delete state.runs[key]
  }
  await writeJsonAtomic(stateFile, state)
}
async function directTask(taskId, sessionId) {
  if (!taskId) return
  // sessionId 为空表示 spawn_new：清空旧会话的定向，否则新会话无法认领该任务。
  try { await bridge(`/v1/tasks/${encodeURIComponent(taskId)}/direct`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId: sessionId ?? null }) }) }
  catch (error) { log('任务定向失败，继续由执行器认领', error.message) }
}
function killProcessTree(child) {
  if (!child?.pid) return
  try { child.kill('SIGTERM') } catch {}
  setTimeout(() => {
    if (child.exitCode !== null) return
    if (process.platform === 'win32') spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' })
    else { try { process.kill(-child.pid, 'SIGKILL') } catch { try { child.kill('SIGKILL') } catch {} } }
  }, 3_000).unref()
}
async function launch(item, project) {
  const previous = runState(item.runId)
  const sessionId = item.decision === 'dispatch_existing' ? item.sessionId : undefined
  if (dryRun) { log('DRY RUN 派单', { projectId: project.id, runId: item.runId, sessionId }); return }
  await directTask(item.taskId, sessionId)
  await mkdir(stateDir, { recursive: true })
  const inputPath = join(stateDir, `codex-launch-${String(item.runId).replace(/[^A-Za-z0-9_-]/g, '_')}-${Date.now()}.json`)
  const message = sessionId
    ? `LCOS 接单提示：项目 ${project.id} 有新待办 run ${item.runId}。请按 lcos-executor-run skill 读取冻结上下文，认领、执行并提交。`
    : `LCOS 接单提示：项目 ${project.id} 有新待办 run ${item.runId}。请按 lcos-executor-run skill 认领、执行并提交结果。`
  await writeFile(inputPath, JSON.stringify({
    codexBin, projectRoot: item.projectRoot || project.rootPath, message, sessionId, taskId: item.taskId || '', runId: item.runId,
    projectId: project.id, bridgeUrl, cancellationPollMs: 750, gracefulCancelMs: 3_000,
  }), 'utf8')
  log('启动 Codex Runner', { projectId: project.id, runId: item.runId, sessionId: sessionId || null })
  const child = spawn(process.execPath, [runner, inputPath], {
    cwd: repoRoot, env: process.env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32',
  })
  let output = ''
  const append = (chunk, stream) => {
    const text = chunk.toString('utf8'); output = (output + text).slice(-4_000_000); stream.write(text)
  }
  child.stdout.on('data', (chunk) => append(chunk, process.stdout))
  child.stderr.on('data', (chunk) => append(chunk, process.stderr))
  const exited = new Promise((resolveExit) => child.once('exit', (code, signal) => resolveExit({ timedOut: false, code: code ?? 1, signal })))
  let exit
  try {
    exit = await runWithTimeout(() => exited, runnerTimeoutMs, { onTimeout: () => killProcessTree(child) })
  } catch (error) {
    if (!(error instanceof TaskTimeoutError)) throw error
    await Promise.race([
      exited,
      new Promise((resolveWait) => setTimeout(resolveWait, 5_000)),
    ])
    exit = { timedOut: true, code: 124 }
  }
  const marker = parseRunnerMarker(output)
  const success = exit.code === 0 && marker?.closureObserved === true
  if (success) {
    const resolvedSessionId = marker.sessionId || sessionId
    if (resolvedSessionId) await saveBinding(project.id, resolvedSessionId, item.runId, 'active', 0).catch((error) => log('保存 Session Binding 失败', error.message))
    await updateRunState(item.runId, { attempts: 0, nextAttemptAt: 0, exhausted: false, taskId: item.taskId || null, lastOutcome: 'success', sessionId: resolvedSessionId || null })
    log('Codex Runner 完成', { projectId: project.id, runId: item.runId, taskStatus: marker.taskStatus, sessionId: resolvedSessionId || null })
    return
  }
  const attempts = Number(previous.attempts || 0) + 1
  const delay = nextRetryDelay(attempts - 1)
  const exhausted = attempts >= maxAttempts
  if (marker?.sessionInvalid && sessionId) await saveBinding(project.id, sessionId, item.runId, 'stale', attempts).catch(() => {})
  await updateRunState(item.runId, {
    attempts,
    taskId: item.taskId || null,
    exhausted,
    nextAttemptAt: exhausted ? 0 : Date.now() + delay,
    lastOutcome: marker?.failureKind || (exit.timedOut ? 'timeout' : 'runner_exit'),
  })
  log(exhausted ? 'Codex Runner 重试已用尽，等待人工恢复或新 Task' : 'Codex Runner 未闭环，已安排有限退避', {
    projectId: project.id, runId: item.runId, attempts, maxAttempts, ...(exhausted ? {} : { retryInMs: delay }), marker, exit,
  })
}
async function scanOnce() {
  const projects = await core('/projects')
  let scheduled = 0
  for (const project of projects) {
    if (selectedProjects.size && !selectedProjects.has(String(project.id))) continue
    let plan
    try { plan = await dispatchPlan(project) }
    catch (error) { log(`获取 ${project.id} 派单计划失败`, error.message); continue }
    for (const item of plan) {
      if (item.decision === 'wait') { log('任务暂缓', { projectId: project.id, runId: item.runId, reason: item.reason }); continue }
      let current = runState(item.runId)
      if (current.taskId && item.taskId && current.taskId !== item.taskId) {
        await updateRunState(item.runId, { attempts: 0, exhausted: false, nextAttemptAt: 0, taskId: item.taskId, lastOutcome: 'new_task' })
        current = runState(item.runId)
      }
      if (current.exhausted === true) continue
      if (Number(current.nextAttemptAt || 0) > Date.now() || pool.hasRun(item.runId)) continue
      if (pool.enqueue(String(project.id), String(item.runId), () => launch(item, project))) scheduled += 1
    }
  }
  return scheduled
}
async function main() {
  await acquireLock()
  log('LCOS 异步看门狗启动', { concurrency, maxAttempts, coreUrl, bridgeUrl, codexBin, once })
  let delay = minPollMs
  try {
    do {
      let scheduled = 0
      try { scheduled = await scanOnce() }
      catch (error) { log('看门狗扫描失败', error.message) }
      if (once) { await pool.idle(); break }
      delay = scheduled > 0 ? minPollMs : Math.min(maxPollMs, Math.max(minPollMs, Math.round(delay * 1.6)))
      await new Promise((resolveWait) => setTimeout(resolveWait, delay))
    } while (!stopping)
  } finally {
    stopping = true
    await pool.idle()
    await releaseLock()
  }
}
process.on('SIGINT', () => { stopping = true })
process.on('SIGTERM', () => { stopping = true })
await main()

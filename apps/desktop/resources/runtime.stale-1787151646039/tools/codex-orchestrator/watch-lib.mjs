import { readFile, writeFile, rename, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

export class ProjectTaskPool {
  #activeProjects = new Set()
  #activeRuns = new Set()
  #running = 0
  #limit
  #queue = []

  constructor(limit = 2) {
    this.#limit = Math.max(1, Math.floor(limit))
  }

  hasRun(runId) { return this.#activeRuns.has(runId) || this.#queue.some((item) => item.runId === runId) }
  get running() { return this.#running }
  get queued() { return this.#queue.length }

  enqueue(projectId, runId, task) {
    if (this.hasRun(runId)) return false
    this.#queue.push({ projectId, runId, task })
    this.#drain()
    return true
  }

  async idle() {
    while (this.#running > 0 || this.#queue.length > 0) await new Promise((resolve) => setTimeout(resolve, 25))
  }

  #drain() {
    if (this.#running >= this.#limit) return
    const index = this.#queue.findIndex((item) => !this.#activeProjects.has(item.projectId))
    if (index < 0) return
    const [item] = this.#queue.splice(index, 1)
    this.#running += 1
    this.#activeProjects.add(item.projectId)
    this.#activeRuns.add(item.runId)
    Promise.resolve()
      .then(item.task)
      .catch(() => {})
      .finally(() => {
        this.#running -= 1
        this.#activeProjects.delete(item.projectId)
        this.#activeRuns.delete(item.runId)
        this.#drain()
      })
    this.#drain()
  }
}


export class TaskTimeoutError extends Error {
  constructor(message = 'Task timed out.', details = {}) {
    super(message)
    this.name = 'TaskTimeoutError'
    this.code = 'TASK_TIMEOUT'
    this.details = details
  }
}

export async function runWithTimeout(task, timeoutMs, { onTimeout } = {}) {
  const safeTimeoutMs = Math.max(1, Math.floor(Number(timeoutMs) || 0))
  let timer
  let settled = false
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(async () => {
      if (settled) return
      try { await onTimeout?.() } catch {}
      reject(new TaskTimeoutError(`Task timed out after ${safeTimeoutMs}ms.`, { timeoutMs: safeTimeoutMs }))
    }, safeTimeoutMs)
  })
  try {
    return await Promise.race([Promise.resolve().then(task), timeout])
  } finally {
    settled = true
    if (timer) clearTimeout(timer)
  }
}

export function nextRetryDelay(attempt, { baseMs = 30_000, maxMs = 15 * 60_000 } = {}) {
  const safeAttempt = Math.max(0, Math.floor(attempt))
  return Math.min(maxMs, baseMs * 2 ** Math.min(safeAttempt, 8))
}

export function parseRunnerMarker(text) {
  const lines = String(text).split(/\r?\n/).reverse()
  const line = lines.find((item) => item.startsWith('LCOS_CODEX_RESULT:'))
  if (!line) return undefined
  try { return JSON.parse(line.slice('LCOS_CODEX_RESULT:'.length)) }
  catch { return undefined }
}

export async function readJsonFile(path, fallback) {
  try { return JSON.parse(await readFile(path, 'utf8')) }
  catch { return fallback }
}

export async function writeJsonAtomic(path, value) {
  await mkdir(dirname(path), { recursive: true })
  const temp = `${path}.${process.pid}.${Date.now()}.partial`
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  await rename(temp, path)
}

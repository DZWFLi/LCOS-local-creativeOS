import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

export const PORT_LC = 43121

export interface LocalCoreHarness {
  readonly dbDir: string
  start(): Promise<void>
  stop(): Promise<void>
}

export async function waitForLocalCore(port = PORT_LC, timeout = 20000): Promise<boolean> {
  const started = Date.now()
  while (true) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`, { cache: 'no-store' })
      if (response.ok) return true
    } catch {
      // Server may be between shutdown and restart; keep polling until timeout.
    }
    if (Date.now() - started > timeout) return false
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
}

/**
 * 每个 spec 文件独立 spawn 一份 Local Core（独立 SQLite），结束后回收。
 * Playwright 已设 workers:1，端口不会跨文件冲突。
 */
export function createLocalCoreHarness(overrides: NodeJS.ProcessEnv = {}): LocalCoreHarness {
  const root = path.resolve(import.meta.dirname, '..', '..')
  const dbDir = mkdtempSync(path.join(tmpdir(), 'lcos-e2e-db-'))
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    LOCAL_CORE_DB_PATH: path.join(dbDir, 'phase2.sqlite'),
    LOCAL_CORE_API_TOKEN: process.env.LOCAL_CORE_API_TOKEN ?? 'e2e-local-token',
    ...overrides,
  }
  let child: ReturnType<typeof spawn> | null = null
  return {
    dbDir,
    async start() {
      child = spawn(process.execPath, ['apps/local-core/dist/index.js'], { cwd: root, stdio: 'ignore', env })
      const ok = await waitForLocalCore()
      if (!ok) throw new Error('Local Core did not start')
    },
    async stop() {
      const current = child
      child = null
      if (current === null || current.exitCode !== null || current.signalCode !== null) return
      const exited = new Promise<void>((resolve) => current.once('exit', () => resolve()))
      current.kill()
      await exited
    },
  }
}

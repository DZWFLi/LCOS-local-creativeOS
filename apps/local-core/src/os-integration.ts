import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { isAbsolute } from 'node:path'

/**
 * Phase A：OS 集成（Reveal Folder）。
 *
 * 只允许打开"已注册的绝对路径"，由调用方保证路径来自 Project Catalog；
 * 这里只做绝对路径 + 存在性校验，不提供任意路径打开能力。
 */
export interface RevealResult {
  readonly ok: boolean
  readonly error?: string
}

export function revealRegisteredPath(path: string): Promise<RevealResult> {
  return new Promise((resolve) => {
    if (!isAbsolute(path) || !existsSync(path)) {
      resolve({ ok: false, error: `Path does not exist: ${path}` })
      return
    }
    try {
      let child: ReturnType<typeof spawn>
      if (process.platform === 'win32') {
        child = spawn('explorer.exe', [path], { stdio: 'ignore', detached: true, windowsHide: true })
      } else if (process.platform === 'darwin') {
        child = spawn('open', ['-R', path], { stdio: 'ignore', detached: true })
      } else {
        child = spawn('xdg-open', [path], { stdio: 'ignore', detached: true })
      }
      child.once('error', (error) => resolve({ ok: false, error: error.message }))
      child.once('spawn', () => resolve({ ok: true }))
      child.unref()
    } catch (error) {
      resolve({ ok: false, error: error instanceof Error ? error.message : String(error) })
    }
  })
}

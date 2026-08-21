/**
 * E2E preflight：手测栈占用 43121/5173 时，reuseExistingServer 会静默复用
 * 错误 token/DB 的 Core/Vite → 401 全崩。这里先探测，占用即 FAIL FAST。
 */
export default async function globalSetup(): Promise<void> {
  const busy: number[] = []
  for (const port of [43121, 5173]) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(400) })
      if (response) busy.push(port)
    } catch {
      // 端口空闲
    }
  }
  if (busy.length > 0) {
    throw new Error(`E2E 需要独占 43121/5173；检测到手测栈占用 ${busy.join('/')}。请先停栈（npm run dev:stop）再跑 test:e2e。`)
  }
}

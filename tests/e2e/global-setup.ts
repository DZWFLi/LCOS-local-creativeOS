/**
 * E2E preflight：spec 会自行启动 Local Core，因此 43121 必须空闲。
 * Vite 5173 由 Playwright webServer 在 globalSetup 之前启动，并通过
 * reuseExistingServer:false 自己保证独占；这里再次探测会误报测试自己的 Vite。
 */
export default async function globalSetup(): Promise<void> {
  const busy: number[] = []
  for (const port of [43121]) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(400) })
      if (response) busy.push(port)
    } catch {
      // 端口空闲
    }
  }
  if (busy.length > 0) {
    throw new Error(`E2E 需要独占 43121；检测到手测栈占用 ${busy.join('/')}。请先停栈（npm run dev:stop）再跑 test:e2e。`)
  }
}

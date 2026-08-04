import { defineConfig } from '@playwright/test'

// E2E 自洽鉴权：Vite 代理与 spec 内启动的 Local Core 共用同一 token，
// 不依赖本机 .codex-runtime/local-core-token 是否存在。
process.env.LOCAL_CORE_API_TOKEN ??= 'e2e-local-token'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  retries: 0,
  webServer: {
    command: 'npm run dev:web',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: false,
    timeout: 30000,
  },
  use: {
    baseURL: 'http://127.0.0.1:5173',
    headless: true,
    viewport: { width: 1280, height: 720 },
  },
})

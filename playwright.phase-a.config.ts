import { defineConfig, devices } from '@playwright/test'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

process.env.LOCAL_CORE_API_TOKEN ??= 'e2e-local-token'

const chromiumLaunchArgs = [
  '--use-fake-device-for-media-stream',
  '--use-fake-ui-for-media-stream',
]

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'v015-phase-a-admission.spec.ts',
  timeout: 45_000,
  expect: { timeout: 8_000 },
  retries: 0,
  workers: 1,
  fullyParallel: false,
  outputDir: join(tmpdir(), `lcos-phase-a-playwright-${process.pid}-${Date.now()}`),
  globalSetup: './tests/e2e/global-setup.ts',
  webServer: {
    command: 'npm run dev:web',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: false,
    timeout: 45_000,
  },
  use: {
    baseURL: 'http://127.0.0.1:5173',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: { args: chromiumLaunchArgs },
  },
  projects: [
    { name: 'chromium-dpr100', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 } },
    { name: 'chromium-dpr125', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1.25 } },
    { name: 'chromium-dpr150', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1.5 } },
  ],
})

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '..', '..', '..')
const read = (path: string) => readFileSync(resolve(root, path), 'utf8').replace(/\r\n/g, '\n')

describe('dev-only Runtime Diagnostics integration', () => {
  it('keeps diagnostics on an isolated development-only route', () => {
    const main = read('apps/web/src/main.tsx')

    expect(main).toContain("import.meta.env.DEV && window.location.pathname === '/__diagnostics'")
    expect(main).toContain('diagnosticsRoute ? <RuntimeDiagnosticsPage /> : <App />')
  })

  it('proxies only the versioned Local Core namespace to loopback', () => {
    const vite = read('apps/web/vite.config.ts')

    expect(vite).toContain("'/api/local-core/v1'")
    expect(vite).toContain("process.env.LOCAL_CORE_PROXY_TARGET ?? 'http://127.0.0.1:43121'")
    expect(vite).toContain('target: localCoreTarget')
    expect(vite).not.toContain('0.0.0.0')
  })

  it('keeps diagnostics Runtime-only without fixture fallback', () => {
    const diagnostics = read('apps/web/src/features/diagnostics/RuntimeDiagnosticsPage.tsx')

    expect(diagnostics).toContain('<SourceBadge origin="runtime" />')
    expect(diagnostics).toContain('Diagnostics never falls back to Fixture')
    expect(diagnostics).toContain('pickDiagnosticsProjectId')
  })

  it('keeps the structured report viewer read-only', () => {
    const diagnostics = read('apps/web/src/features/diagnostics/RuntimeDiagnosticsPage.tsx')
    const packageJson = read('package.json')

    expect(diagnostics).toContain('网页不能启动测试或执行 Shell')
    expect(packageJson).toContain('"test:report"')
    expect(packageJson).toContain('--outputFile=public/dev-test-report.json')
  })
})

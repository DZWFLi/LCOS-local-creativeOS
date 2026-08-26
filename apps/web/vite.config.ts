import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const rootPackage = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { version?: string }
const localCoreToken = process.env.LOCAL_CORE_API_TOKEN
const localCoreTarget = process.env.LOCAL_CORE_PROXY_TARGET ?? 'http://127.0.0.1:43121'

function gitValue(command: string): string {
  try {
    return execSync(command, { cwd: new URL('../..', import.meta.url), encoding: 'utf8' }).trim()
  } catch {
    return 'unknown'
  }
}

export default defineConfig({
  plugins: [react()],
  // A-6（20260826 钉配置）：vite root 指向仓库根导致 vitest 默认扫到根 tests/e2e 的 legacy
  // playwright specs（此前靠命令行 --exclude 口头约定）。这里在配置层排除，裸 vitest run 即安全。
  test: {
    exclude: [...configDefaults.exclude, '**/tests/e2e/**'],
  },
  root: '../..',
  define: {
    'import.meta.env.VITE_LCOS_VERSION': JSON.stringify(rootPackage.version ?? 'unknown'),
    'import.meta.env.VITE_LCOS_BRANCH': JSON.stringify(gitValue('git branch --show-current')),
    'import.meta.env.VITE_LCOS_COMMIT': JSON.stringify(gitValue('git rev-parse --short HEAD')),
  },
  server: {
    proxy: {
      '/api/local-core/v1': {
        target: localCoreTarget,
        changeOrigin: false,
        rewrite: (path) => path.replace(/^\/api\/local-core\/v1/, ''),
        ...(localCoreToken === undefined ? {} : { headers: { authorization: `Bearer ${localCoreToken}` } }),
      },
    },
  },
})

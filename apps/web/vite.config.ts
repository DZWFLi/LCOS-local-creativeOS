import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const rootPackage = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { version?: string }
const localCoreToken = process.env.LOCAL_CORE_API_TOKEN

function gitValue(command: string): string {
  try {
    return execSync(command, { cwd: new URL('../..', import.meta.url), encoding: 'utf8' }).trim()
  } catch {
    return 'unknown'
  }
}

export default defineConfig({
  plugins: [react()],
  root: '../..',
  define: {
    'import.meta.env.VITE_LCOS_VERSION': JSON.stringify(rootPackage.version ?? 'unknown'),
    'import.meta.env.VITE_LCOS_BRANCH': JSON.stringify(gitValue('git branch --show-current')),
    'import.meta.env.VITE_LCOS_COMMIT': JSON.stringify(gitValue('git rev-parse --short HEAD')),
  },
  server: {
    proxy: {
      '/api/local-core/v1': {
        target: 'http://127.0.0.1:43121',
        changeOrigin: false,
        rewrite: (path) => path.replace(/^\/api\/local-core\/v1/, ''),
        ...(localCoreToken === undefined ? {} : { headers: { authorization: `Bearer ${localCoreToken}` } }),
      },
    },
  },
})

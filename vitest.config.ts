import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    exclude: [
      '**/node_modules/**',
      '前端测试/**',
      '.playwright-cli/**',
      '**/.tmp/**',
      'tests/e2e/**',
    ],
    // Worker 并发策略按 workspace 分别控制（web 用默认并发，local-core 在 package.json
    // test 脚本显式 --maxWorkers=1 串行，避免 SQLite/文件系统竞争；web 测试在 maxWorkers=1
    // 下 vitest 4.1.10 fork pool 会偶发 worker 崩溃，所以不能全局压到 1）。
    maxWorkers: undefined,
  },
})

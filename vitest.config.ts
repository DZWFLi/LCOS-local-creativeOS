import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    exclude: [
      '**/node_modules/**',
      '前端测试/**',
      '.playwright-cli/**',
    ],
  },
})

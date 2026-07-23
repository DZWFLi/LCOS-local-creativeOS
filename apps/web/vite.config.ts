import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  root: '../..',
  server: {
    proxy: {
      '/api/local-core/v1': {
        target: 'http://127.0.0.1:43121',
        changeOrigin: false,
        rewrite: (path) => path.replace(/^\/api\/local-core\/v1/, ''),
      },
    },
  },
})

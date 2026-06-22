import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import svgr from 'vite-plugin-svgr'

const buildDate = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '.').replace(/\.$/, '')

export default defineConfig({
  define: {
    __BUILD_DATE__: JSON.stringify(buildDate),
  },
  plugins: [react(), svgr()],
  server: {
    port: Number(process.env.VITE_DEV_PORT) || 3006,
    open: true,
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET || 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
})
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
    host: true,
    port: Number(process.env.VITE_DEV_PORT) || 3006,
    open: true,
    proxy: {
      '/api': {
        //target: process.env.VITE_PROXY_TARGET || 'http://localhost:8080',
        //target: process.env.VITE_PROXY_TARGET || 'http://192.168.1.8:3005',
        //target: process.env.VITE_PROXY_TARGET || 'http://221.114.5.65:3005',
        target: process.env.VITE_PROXY_TARGET || 'http://220.93.155.150:3005',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
})
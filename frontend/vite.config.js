import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Proxy all /api/* calls to the PHP backend running on WAMP
      '/api': {
        target: 'http://localhost/OrderTrackingSystem/backend',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/api'),
      },
      // Proxy image paths served by Apache
      '/uploads': {
        target: 'http://localhost/OrderTrackingSystem/backend',
        changeOrigin: true,
      },
    },
  },
})

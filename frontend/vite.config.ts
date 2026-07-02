import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// Dev: Vite on :5173 proxies /api -> Flask :5000.
// Prod: `npm run build` emits the hashed SPA into ../backend/static_spa, which Flask serves.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:5000',
      '/problem-images': 'http://localhost:5000',
    },
  },
  build: {
    outDir: path.resolve(__dirname, '../backend/static_spa'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 1500,
  },
})

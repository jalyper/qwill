import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    // A desktop app loads its bundle from disk, so the web-oriented 500 kB
    // warning is noise; the .docx reader/writer are already split out and
    // lazy-loaded.
    chunkSizeWarningLimit: 1000,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    exclude: ['e2e/**', 'node_modules/**', 'src-tauri/**'],
  },
})

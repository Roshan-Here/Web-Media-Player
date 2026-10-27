/// <reference types="node" />
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  resolve: {
    // The demo runs on the package's own source, so changes show without a build.
    alias: {
      '@roshan-here/web-media-player/style.css': fileURLToPath(
        new URL('../../dist/style.css', import.meta.url),
      ),
      '@roshan-here/web-media-player': fileURLToPath(
        new URL('../../src/index.ts', import.meta.url),
      ),
    },
  },
  // movi-player finds movi.wasm next to its own script; pre-bundling would move the script away.
  optimizeDeps: { exclude: ['movi-player'] },
})

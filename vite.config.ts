import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  server: {
    watch: {
      // Force full page reload instead of HMR so canvas re-initialises cleanly
      usePolling: false,
    },
    hmr: {
      // Trigger a full reload when SnakeBlast.tsx changes
      overlay: true,
    },
  },
})

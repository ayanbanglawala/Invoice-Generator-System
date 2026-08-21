import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Rolldown (Vite 8's bundler) requires manualChunks as a function,
        // not the plain object form older Vite/Rollup accepted.
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          // React itself changes rarely — its own chunk means the browser
          // can cache it across deploys where only your app code changed.
          if (/node_modules\/(react|react-dom|react-router-dom|scheduler)\//.test(id)) {
            return "vendor-react";
          }
          // These are only used on a couple of pages (PDF export, Excel
          // export) but are large — isolating them means they're never
          // even downloaded by someone who only views the Dashboard.
          if (/node_modules\/(jspdf|html2canvas)\//.test(id)) {
            return "vendor-pdf";
          }
          if (/node_modules\/xlsx\//.test(id)) {
            return "vendor-xlsx";
          }
        },
      },
    },
    // Silence the default 500kb warning for the (expected, isolated)
    // vendor-pdf chunk — it's lazy-loaded on demand, not part of the
    // initial bundle, so its size doesn't affect first load.
    chunkSizeWarningLimit: 700,
  },
})

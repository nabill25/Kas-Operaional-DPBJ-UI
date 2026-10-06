import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// API (Express) berjalan di port 5211 saat development; Vite meneruskan /api ke sana
// sehingga cookie sesi tetap satu origin (http://localhost:5210).
const apiTarget = process.env.KAS_API_URL ?? 'http://127.0.0.1:5211';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5210,
    strictPort: true,
    proxy: {
      '/api': { target: apiTarget, changeOrigin: false },
    },
  },
  preview: {
    port: 5210,
    strictPort: true,
    proxy: {
      '/api': { target: apiTarget, changeOrigin: false },
    },
  },
  build: {
    chunkSizeWarningLimit: 1200,
  },
});

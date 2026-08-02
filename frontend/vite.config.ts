import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      // Single origin by design. The backend sets its auth cookies with
      // sameSite=strict, so they are only sent on same-site requests — the
      // browser must see one origin. changeOrigin stays false for that reason.
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: false,
      },
    },
  },
});

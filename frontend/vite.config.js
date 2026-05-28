import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api/weather':  { target: 'http://localhost:3001', changeOrigin: true, rewrite: (p) => p.replace(/^\/api\/weather/, '') },
      '/api/forecast': { target: 'http://localhost:3001', changeOrigin: true, rewrite: (p) => p.replace(/^\/api\/forecast/, '') },
      '/api/location': { target: 'http://localhost:3002', changeOrigin: true, rewrite: (p) => p.replace(/^\/api\/location/, '') },
      '/api/person':   { target: 'http://localhost:3003', changeOrigin: true, rewrite: (p) => p.replace(/^\/api\/person/, '') },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
  },
});

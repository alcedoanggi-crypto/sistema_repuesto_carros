import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// En desarrollo el frontend corre en :5180 y redirige /api y /uploads a la API en :4600
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5180,
    proxy: {
      '/api': 'http://localhost:4600',
      '/uploads': 'http://localhost:4600',
      '/sitemap.xml': 'http://localhost:4600',
    },
  },
});

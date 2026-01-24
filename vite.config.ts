import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // Garante que process.env funcione no código cliente (necessário para a API Key do Gemini)
    'process.env': process.env
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true,
      },
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});
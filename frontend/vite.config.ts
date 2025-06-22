import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Set base if deploying to a subpath, otherwise omit or set to '/'
  // base: '/seaside/',

  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    host: true,
    port: 5173,
    strictPort: false,
    proxy: {
      '/create-room': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/join-room': {
        target: 'ws://localhost:8080',
        ws: true,
        changeOrigin: true,
        rewrite: (path) => path, // Ensure path is preserved
      },
    },
  },
});
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  root: './',
  build: {
    outDir: 'public/dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html')
      },
      output: {
        entryFileNames: 'index.js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]'
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  },
  server: {
    host: '0.0.0.0',
    port: 5000,
    hmr: {
      clientPort: 5000
    },
    allowedHosts: true,
    headers: {
      'X-Frame-Options': 'ALLOWALL'
    }
  }
});

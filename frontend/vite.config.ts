import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  // In dev: proxy to VITE_API_URL if set, otherwise to the live backend
  const proxyTarget = env.VITE_API_URL || 'https://www.festv.org';

  return {
    plugins: [react()],
    server: {
      port: 3000,
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
    publicDir: 'public',
    build: {
      outDir: '../backend/public/react-dist',
      emptyOutDir: true,
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks: undefined,
        },
      },
    },
  };
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);


export default defineConfig({
  // Use relative asset paths so the app works from GitHub Pages project URLs like:
  // https://<org>.github.io/<repo>/
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifestFilename: 'site.webmanifest',
      manifest: {
        name: 'Orca Control Panel',
        short_name: 'Orca',
        description: 'Configure your Orca controller with intuitive visual remapping',
        start_url: '.',
        scope: '.',
        icons: [
          {
            src: 'web-app-manifest-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: 'web-app-manifest-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
        theme_color: '#1a1a2e',
        background_color: '#1a1a2e',
        display: 'standalone',
        orientation: 'any',
      },
      workbox: {
        navigateFallback: 'index.html',
        // Workbox uses Rollup+Terser when `mode: 'production'`, which can be flaky on very new Node versions.
        // This keeps the SW unminified but reliable for GH Pages.
        mode: 'development',
      },
    }),
  ],
  resolve: {
    alias: {
      '@shared': resolve(__dirname, './src/generated'),
    },
  },
  server: {
    fs: {
      allow: [resolve(__dirname, '..')],
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
    },
  },
  publicDir: 'public',
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});

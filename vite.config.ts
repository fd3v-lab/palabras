/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
const base = process.env.BASE_PATH || '/'

export default defineConfig({
  base,
  worker: { format: 'es' },
  optimizeDeps: {
    exclude: ['@mintplex-labs/piper-tts-web', 'onnxruntime-web', '@huggingface/transformers'],
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Palabras',
        short_name: 'Palabras',
        description: 'Learn Spanish vocabulary and sentences with spaced repetition.',
        theme_color: '#4f46e5',
        background_color: '#f7f7fb',
        display: 'standalone',
        start_url: base,
        scope: base,
        icons: [
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,json}'],
        // Large ML assets (ORT / piper WASM, models) are never precached.
        globIgnores: ['vendor/**', '**/*.wasm', '**/*.onnx', '**/*.data'],
        navigateFallback: `${base}index.html`,
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith(`${base}vendor/`),
            handler: 'CacheFirst',
            options: {
              cacheName: 'ml-vendor',
              expiration: { maxEntries: 20 },
              rangeRequests: true,
            },
          },
          {
            urlPattern: ({ url }) => url.hostname === 'cdn.jsdelivr.net',
            handler: 'CacheFirst',
            options: {
              cacheName: 'ml-cdn',
              expiration: { maxEntries: 20 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})

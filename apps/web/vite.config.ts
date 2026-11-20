import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // 'prompt': la caja nunca se recarga sola en medio de una venta; el usuario decide (PwaUpdater).
      registerType: 'prompt',
      // El registro lo hace PwaUpdater con virtual:pwa-register/react.
      injectRegister: false,
      // public/ ya entra por globPatterns; así los íconos no se precachean dos veces.
      includeManifestIcons: false,
      manifest: {
        id: '/',
        name: 'Tus Antojos',
        short_name: 'Tus Antojos',
        description: 'Punto de venta, cocina y administración de Tus Antojos',
        lang: 'es',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        theme_color: '#ab0909',
        background_color: '#ffffff',
        categories: ['business', 'food', 'productivity'],
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // App shell completo en caché (incluye public/: íconos de `pnpm pwa:icons`).
        // La caja abre sin conexión (CE-13).
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2}'],
        // SPA: cualquier navegación sin red sirve index.html y React Router resuelve la ruta.
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        // La API y Supabase (auth, datos, Realtime) van a otros orígenes y NO se cachean:
        // los pedidos offline van por la cola en IndexedDB (módulo offline-print), no por el SW.
        runtimeCaching: [
          {
            // Imágenes públicas de Supabase Storage (fotos del catálogo) visibles sin conexión.
            urlPattern: ({ url }) => url.pathname.startsWith('/storage/v1/object/public/'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'catalog-images',
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      // SW apagado en `vite dev` (evita cachés viejas y no afecta a los e2e).
      // Para probar la PWA: `pnpm build && pnpm preview`.
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { port: 5173, strictPort: true },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**'],
    css: false,
  },
});

import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      // Registramos el service worker a mano en main.js (via virtual:pwa-register) para poder
      // detectar cuándo hay una versión nueva y recargar automáticamente — de lo contrario, en
      // una SPA que casi nunca hace una navegación completa del navegador, el usuario se puede
      // quedar viendo el bundle viejo por horas aunque ya haya un despliegue nuevo.
      injectRegister: false,
      includeAssets: ['icons/favicon-32.png'],
      manifest: {
        name: 'Struktiva · Control de Compras',
        short_name: 'Struktiva',
        description: 'Control de Compras y Requisiciones de Obra — Struktiva Ingeniería y Construcción',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#F3F6F7',
        theme_color: '#123B54',
        lang: 'es-MX',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
        ],
      },
      workbox: {
        // El app shell (JS/CSS/HTML) se cachea para que abra sin conexión.
        // Las llamadas a /api NO se cachean: los datos deben ser siempre reales o fallar
        // explícitamente (el guardado offline de Requisiciones se maneja aparte, ver lib/offlineQueue.js).
        globPatterns: ['**/*.{js,css,html,png,svg}'],
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: /^\/api\//,
            handler: 'NetworkOnly',
          },
        ],
      },
      devOptions: {
        enabled: true,
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});

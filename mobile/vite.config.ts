import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg'],
      manifest: {
        name: 'MOE SERPS',
        short_name: 'SERPS',
        description: 'Ministry of Education School Enterprise Resource Planning System',
        theme_color: '#165DFF',
        background_color: '#f5f7fa',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/icons/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          // Cache timetable data for offline viewing
          {
            urlPattern: /\/api\/v1\/sms\/timetable/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'timetable-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 86400 },
            },
          },
          // Cache grade data for offline viewing
          {
            urlPattern: /\/api\/v1\/grades/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'grades-cache',
              expiration: { maxEntries: 20, maxAgeSeconds: 3600 },
            },
          },
          // Cache attendance sessions for offline
          {
            urlPattern: /\/api\/v1\/attendance/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'attendance-cache',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 20, maxAgeSeconds: 3600 },
            },
          },
          // Cache dashboard stats
          {
            urlPattern: /\/api\/v1\/dashboard/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'dashboard-cache',
              expiration: { maxEntries: 5, maxAgeSeconds: 300 },
            },
          },
        ],
      },
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 3001,
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
})

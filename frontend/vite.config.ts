import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { resolve } from 'node:path'

const pages = (names: string[]): Record<string, string> => Object.fromEntries(names.map((n) => [n, resolve(__dirname, `${n}.html`)]))

// https://vite.dev/config/
// Four pages: index.html (the game), site.html (the public landing page), teacher.html (teachers), admin.html (admin panel).
// The Android app (`--mode android`) only ships the game.
export default defineConfig(({ mode }) => ({
  plugins: [
    vue(),
    tailwindcss(),
    // Installable, offline web app. Not needed inside the Android app, which already ships every file.
    VitePWA({
      disable: mode === 'android',
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'BrainSprint Kids',
        short_name: 'BrainSprint',
        description: 'Fast, fun maths, English, science and SST practice for nursery and primary children.',
        theme_color: '#16a34a',
        background_color: '#f4f7f5',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './index.html', // open the game, not the landing page
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        globIgnores: ['admin.html', 'assets/admin-*', 'teacher.html', 'assets/teacher-*'], // staff pages are never cached on children's devices
        navigateFallbackDenylist: [/\/api\//, /admin\.html/, /site\.html/, /teacher\.html/],
      },
    }),
  ],
  base: './', // relative paths so the build also runs inside the mobile app
  build: {
    rollupOptions: {
      input: pages(mode === 'android' ? ['index'] : ['index', 'site', 'admin', 'teacher']),
    },
  },
  server: {
    host: true, // reachable from a phone on the same Wi-Fi
    proxy: {
      // the PHP API runs under XAMPP's Apache
      '/brainsprint/api': 'http://localhost',
    },
  },
}))

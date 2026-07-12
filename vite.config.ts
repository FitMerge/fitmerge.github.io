import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Served from GitHub Pages at https://<owner>.github.io/Test/ , so assets and the
// service worker must resolve under the /Test/ sub-path.
const base = '/Test/'

// Human-readable build stamp, surfaced in Settings → About so it's obvious which
// deployed version is loaded (and that an update actually landed).
const buildTime = new Date().toISOString().slice(0, 16).replace('T', ' ')

export default defineConfig({
  base,
  define: {
    __BUILD_TIME__: JSON.stringify(`${buildTime} UTC`),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Take over immediately on a new deploy instead of waiting for every tab to
      // close (an installed PWA rarely fully closes, which is what left old
      // versions stuck). Combined with the update-check in main.tsx, new builds
      // activate and reload on their own.
      workbox: {
        clientsClaim: true,
        skipWaiting: true,
        cleanupOutdatedCaches: true,
      },
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'FitMerge',
        short_name: 'FitMerge',
        description: 'Nutrition, macro photos and custom workouts in one app.',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        scope: base,
        start_url: base,
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages serves a user/org site (a repo literally named <name>.github.io)
// from the root, and every other repo from /<repo-name>/. Derive the base from
// GITHUB_REPOSITORY so assets and the service worker resolve correctly no matter
// which repo builds this — moving the project to an org needs no edit here.
// Outside Actions (local dev/preview) the root is always right.
const ghRepo = process.env.GITHUB_REPOSITORY?.split('/')[1]
const base = !ghRepo || ghRepo.endsWith('.github.io') ? '/' : `/${ghRepo}/`

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
        name: 'Rung',
        short_name: 'Rung',
        description: 'Training, food and recovery in one place.',
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

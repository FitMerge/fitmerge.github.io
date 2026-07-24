import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
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

function git(command: string, fallback: string): string {
  try {
    return execSync(command, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return fallback // no git available (e.g. a tarball build) — degrade, don't fail
  }
}

// The version number derives itself. It used to be a string literal in the About
// card, so it sat at 0.1.0 across a hundred commits and told you nothing about
// which build you were looking at.
//
// major.minor come from package.json and are yours to bump for real releases;
// the patch is the commit count, so every deploy is a new, ordered version.
//
// NOTE: this needs full git history. actions/checkout defaults to a shallow
// clone (depth 1), which would peg the count at 1 — deploy-pages.yml sets
// fetch-depth: 0 for exactly this reason.
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as {
  version?: string
}
const [major = '0', minor = '0'] = (pkg.version ?? '0.0.0').split('.')
const commitCount = git('git rev-list --count HEAD', '0')
const appVersion = `${major}.${minor}.${commitCount}`
const gitSha = (process.env.GITHUB_SHA ?? git('git rev-parse HEAD', '')).slice(0, 7) || 'dev'

export default defineConfig({
  base,
  define: {
    __BUILD_TIME__: JSON.stringify(`${buildTime} UTC`),
    __APP_VERSION__: JSON.stringify(appVersion),
    __GIT_SHA__: JSON.stringify(gitSha),
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

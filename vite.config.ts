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
  } catch (err) {
    // Degrade rather than fail the build — git may genuinely be absent (a tarball
    // build). But say so: swallowing this silently once already shipped an empty
    // changelog that looked exactly like "no commits yet".
    console.warn(`[build] ${command} failed, using fallback: ${(err as Error).message}`)
    return fallback
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

// "What's new", read straight from git history at build time. A hand-maintained
// CHANGELOG.md would drift out of date the way the hardcoded version string did;
// commit subjects here are already written for people, so use them directly.
// Parsed by shape rather than a delimiter: the sha and date have fixed forms and
// the subject is whatever remains, so no separator character is needed — one line
// per commit, since a subject can never contain a newline.
// Needs full history — deploy-pages.yml sets fetch-depth: 0.
// The format string must stay quoted: unquoted, the shell splits it on spaces
// and git reads %ad as a revision, which fails silently into an empty list.
const changelog = git('git log --no-merges -n 25 --pretty=format:"%h %ad %s" --date=short', '')
  .split('\n')
  .map((line) => /^(\S+) (\d{4}-\d{2}-\d{2}) (.+)$/.exec(line))
  .filter((m) => m !== null)
  .map((m) => ({ sha: m[1], date: m[2], subject: m[3] }))

export default defineConfig({
  base,
  define: {
    __BUILD_TIME__: JSON.stringify(`${buildTime} UTC`),
    __APP_VERSION__: JSON.stringify(appVersion),
    __GIT_SHA__: JSON.stringify(gitSha),
    __CHANGELOG__: JSON.stringify(changelog),
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

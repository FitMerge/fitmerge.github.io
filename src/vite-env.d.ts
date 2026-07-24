/// <reference types="vite/client" />

// Injected at build time via vite `define` — see vite.config.ts.
declare const __BUILD_TIME__: string
/** major.minor from package.json, patch = commit count. Never hardcode this. */
declare const __APP_VERSION__: string
/** Short commit SHA of the deployed build. */
declare const __GIT_SHA__: string

import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './auth/AuthProvider'
import ErrorBoundary, { recordError } from './components/ErrorBoundary'
import './index.css'

// Errors outside React's render path — a rejected sync write, a failed dynamic
// import — never reach the boundary, so catch them here too. Recording only; the
// app keeps running, but Settings → About can then show what actually happened.
window.addEventListener('error', (e) => recordError(e.error ?? e.message, 'script'))
window.addEventListener('unhandledrejection', (e) => recordError(e.reason, 'promise'))

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <HashRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </HashRouter>
    </ErrorBoundary>
  </React.StrictMode>,
)

// Keep an installed PWA current: check for a new service worker on launch, every
// time the app is brought to the foreground, and on a slow poll — then reload once
// when the freshly-deployed worker takes control. Checking on foreground is what
// makes a new build appear within seconds of opening the app, instead of leaving a
// stale version stuck until the cache is cleared by hand. The controller check
// avoids a spurious reload on the very first visit (no prior controller).
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.ready
    .then((registration) => {
      const checkForUpdate = () => void registration.update().catch(() => {})
      checkForUpdate() // immediately on launch
      setInterval(checkForUpdate, 60_000)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') checkForUpdate()
      })
    })
    .catch(() => {
      /* no service worker in this context — ignore */
    })

  if (navigator.serviceWorker.controller) {
    let reloading = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return
      reloading = true
      window.location.reload()
    })
  }
}

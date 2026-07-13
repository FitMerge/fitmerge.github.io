import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './auth/AuthProvider'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </HashRouter>
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

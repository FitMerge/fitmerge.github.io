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

// Keep an installed PWA current: poll the registered service worker for updates,
// and reload once when a freshly-deployed worker takes control. The controller
// check avoids a spurious reload on the very first visit (no prior controller).
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.ready
    .then((registration) => {
      setInterval(() => void registration.update(), 60_000)
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

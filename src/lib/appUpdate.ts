// In-app "get the latest version" — the one-tap equivalent of clearing the cache
// and reopening, without the Safari settings dance. Asks the service worker to
// check for a freshly-deployed build; if one exists it activates and the page
// reloads onto it. Resolves false when already on the newest version.

export async function checkForUpdate(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) {
    window.location.reload()
    return true
  }
  const reg = await navigator.serviceWorker.getRegistration()
  if (!reg) {
    window.location.reload()
    return true
  }

  await reg.update().catch(() => {})

  const worker = reg.installing || reg.waiting
  if (!worker) return false // nothing new — already current

  // A new build is installing. Wait for it to activate (its fresh precache is then
  // live), then reload onto it.
  await new Promise<void>((resolve) => {
    const settle = () => {
      if (worker.state === 'activated') resolve()
    }
    worker.addEventListener('statechange', settle)
    settle()
    setTimeout(resolve, 6000) // safety net if statechange never fires
  })

  window.location.reload()
  return true
}

/**
 * Nuclear option for a service worker that refuses to update: unregister every
 * worker, delete all Cache Storage entries (the precached old build), then reload
 * straight from the network. Use when "Check for updates" keeps saying you're
 * current but the app still looks stale.
 */
export async function forceReload(): Promise<void> {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map((r) => r.unregister()))
    }
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
    }
  } catch {
    /* best effort — reload regardless */
  }
  // Bypass the HTTP cache for the navigation itself.
  window.location.replace(`${window.location.pathname}${window.location.hash || ''}?v=${Date.now()}`)
}

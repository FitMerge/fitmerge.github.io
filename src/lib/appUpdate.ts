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

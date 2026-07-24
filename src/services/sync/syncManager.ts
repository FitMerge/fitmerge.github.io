// Orchestrates two-way sync between the local Zustand stores and a SyncBackend.
//
// On start: for each store, reconcile local vs cloud (merge on first sign-in,
// else cloud-wins), push the result up, then keep both directions live:
//   - remote → local: backend.subscribe applies other devices' changes.
//   - local → remote: store.subscribe writes local changes up (debounced).
// An `applying` guard plus payload-equality checks prevent echo write-storms.

import { STORE_ADAPTERS, type StoreAdapter } from './storeAdapters'
import type { StoreData, SyncBackend } from './backend'

export type SyncMode = 'merge' | 'cloud-wins'

const WRITE_DEBOUNCE_MS = 800

export type SyncManager = {
  stop: () => void
  /** Re-pull every store from the cloud, merge, and apply — used on foreground
   * resume and by the manual "Pull latest now" control. Safe to call anytime. */
  refresh: () => Promise<void>
}

function equal(a: StoreData, b: StoreData): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/**
 * Begin syncing. Returns a handle whose `stop()` detaches every listener and
 * cancels pending writes. Safe to call once per signed-in session.
 */
export async function startSync(
  backend: SyncBackend,
  mode: SyncMode = 'merge',
  onError?: (err: unknown) => void,
): Promise<SyncManager> {
  const unsubs: Array<() => void> = []
  const timers = new Map<string, ReturnType<typeof setTimeout>>()
  // Snapshot most recently written/applied per store, to skip redundant writes.
  const lastSynced = new Map<string, string>()
  let applying = false
  let stopped = false

  const applyRemote = (adapter: StoreAdapter, data: StoreData) => {
    if (equal(adapter.read(), data)) return // nothing changed locally
    applying = true
    try {
      adapter.apply(data)
    } finally {
      applying = false
    }
    lastSynced.set(adapter.name, JSON.stringify(data))
  }

  const pushLocal = async (adapter: StoreAdapter) => {
    const data = adapter.read()
    const serialized = JSON.stringify(data)
    if (lastSynced.get(adapter.name) === serialized) return // unchanged since last sync
    lastSynced.set(adapter.name, serialized)
    try {
      await backend.set(adapter.name, data)
    } catch (err) {
      onError?.(err)
    }
  }

  const scheduleWrite = (adapter: StoreAdapter) => {
    const existing = timers.get(adapter.name)
    if (existing) clearTimeout(existing)
    timers.set(
      adapter.name,
      setTimeout(() => {
        timers.delete(adapter.name)
        if (!stopped) void pushLocal(adapter)
      }, WRITE_DEBOUNCE_MS),
    )
  }

  // Reconcile one store against the cloud: pull the latest snapshot, merge it with
  // local, apply the result, and push the merged superset back up when it differs.
  // Used for the initial sync AND every foreground/manual refresh.
  const reconcile = async (adapter: StoreAdapter) => {
    let cloud: StoreData | null = null
    try {
      cloud = await backend.get(adapter.name)
    } catch (err) {
      onError?.(err)
    }
    const local = adapter.read()
    const reconciled = mode === 'merge' ? adapter.merge(local, cloud) : (cloud ?? local)
    applyRemote(adapter, reconciled)
    // Always push the reconciled result up when it differs from cloud, so a merged
    // superset reaches other devices. (The steady-state dedupe in pushLocal would
    // otherwise suppress this, since applyRemote just recorded it as lastSynced.)
    if (!cloud || !equal(reconciled, cloud)) {
      try {
        await backend.set(adapter.name, reconciled)
      } catch (err) {
        onError?.(err)
      }
    }
    lastSynced.set(adapter.name, JSON.stringify(reconciled))
  }

  for (const adapter of STORE_ADAPTERS) {
    // 1. Reconcile local + cloud and push the result up.
    await reconcile(adapter)

    // 2. Remote → local.
    unsubs.push(
      backend.subscribe(adapter.name, (data) => {
        if (!stopped) applyRemote(adapter, data)
      }),
    )

    // 3. Local → remote (skip changes we caused by applying a remote snapshot).
    unsubs.push(
      adapter.subscribe(() => {
        if (!applying && !stopped) scheduleWrite(adapter)
      }),
    )
  }

  return {
    stop() {
      stopped = true
      for (const unsub of unsubs) unsub()
      for (const timer of timers.values()) clearTimeout(timer)
      timers.clear()
    },
    async refresh() {
      if (stopped) return
      for (const adapter of STORE_ADAPTERS) {
        if (stopped) return
        await reconcile(adapter)
      }
    },
  }
}

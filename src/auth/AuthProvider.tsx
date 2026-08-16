// Cross-device sync glue: wraps the app in an auth/sync context backed by
// Firebase (Google sign-in + Firestore), but stays entirely inert — renders
// children untouched, status stays 'signed-out' — when no Firebase config has
// been pasted into Settings. Every Firebase-touching import below is dynamic
// so the SDK stays out of the app's main entry chunk until it's actually needed.

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  hasFirebaseConfig,
  hasDeviceConfig,
  parseFirebaseConfig,
  saveFirebaseConfig,
  clearFirebaseConfig,
} from '../services/sync/firebaseConfig'
import type { SyncUser } from '../services/sync/firebase'
import type { SyncManager } from '../services/sync/syncManager'

export type AuthStatus = 'signed-out' | 'signing-in' | 'signed-in'
export type SyncState = 'idle' | 'syncing' | 'synced' | 'error'

type AuthContextValue = {
  user: SyncUser | null
  status: AuthStatus
  syncState: SyncState
  configured: boolean
  /** True when this device pasted its own Firebase config instead of using the built-in one. */
  usingOwnProject: boolean
  /**
   * False until we know whether anyone is signed in. Callers that would
   * otherwise flash first-run UI (the onboarding wizard) should wait for this.
   */
  authResolved: boolean
  /** Epoch ms of the last successful cloud reconcile, or null if not synced yet. */
  lastSyncedAt: number | null
  signIn: () => Promise<void>
  /** Email + password sign-in ('signin') or account creation ('signup'). The one
   * auth path that works in an installed iOS home-screen app. Throws on failure so
   * the form can show the error. */
  emailSignIn: (mode: 'signin' | 'signup', email: string, password: string) => Promise<void>
  /** Send a password-reset email. Throws on failure. */
  resetPassword: (email: string) => Promise<void>
  signOut: () => Promise<void>
  /** Force a pull from the cloud right now (merge + apply all stores). */
  refresh: () => Promise<void>
  /** Parses + saves a pasted Firebase config. Returns false if it doesn't look valid. */
  connect: (pastedConfig: string) => boolean
  disconnect: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SyncUser | null>(null)
  const [status, setStatus] = useState<AuthStatus>('signed-out')
  const [syncState, setSyncState] = useState<SyncState>('idle')
  const [configured, setConfigured] = useState<boolean>(() => hasFirebaseConfig())
  const [usingOwnProject, setUsingOwnProject] = useState<boolean>(() => hasDeviceConfig())
  const [authResolved, setAuthResolved] = useState<boolean>(() => !hasFirebaseConfig())
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null)

  const mountedRef = useRef(true)
  const authUnsubRef = useRef<(() => void) | null>(null)
  const syncHandleRef = useRef<SyncManager | null>(null)
  // Bumped whenever the signed-in identity changes, so a slow in-flight
  // startSyncing() from a previous user can detect it's stale and bail out.
  const generationRef = useRef(0)

  function stopSyncing() {
    syncHandleRef.current?.stop()
    syncHandleRef.current = null
    setSyncState('idle')
    setLastSyncedAt(null)
  }

  async function startSyncing(uid: string) {
    const generation = ++generationRef.current
    setSyncState('syncing')
    try {
      const [{ getFirestoreDb }, { FirestoreBackend }, { startSync }] = await Promise.all([
        import('../services/sync/firebase'),
        import('../services/sync/firestoreBackend'),
        import('../services/sync/syncManager'),
      ])
      const db = await getFirestoreDb()
      if (generation !== generationRef.current) return // a newer sign-in/out superseded this
      if (!db) {
        setSyncState('error')
        return
      }
      const backend = new FirestoreBackend(db, uid)
      const handle = await startSync(backend, 'merge', (err) => {
        console.error('[sync] backend error', err)
        if (generation === generationRef.current) setSyncState('error')
      })
      if (generation !== generationRef.current) {
        handle.stop()
        return
      }
      syncHandleRef.current = handle
      setSyncState('synced')
      setLastSyncedAt(Date.now())
    } catch (err) {
      console.error('[sync] failed to start sync', err)
      if (generation === generationRef.current) setSyncState('error')
    }
  }

  /** Force an immediate cloud re-pull. No-op when not actively syncing. */
  async function refresh(): Promise<void> {
    const handle = syncHandleRef.current
    if (!handle) return
    setSyncState('syncing')
    try {
      await handle.refresh()
      if (!mountedRef.current) return
      setSyncState('synced')
      setLastSyncedAt(Date.now())
    } catch (err) {
      console.error('[sync] refresh failed', err)
      if (mountedRef.current) setSyncState('error')
    }
  }

  function handleAuthChange(next: SyncUser | null) {
    if (!mountedRef.current) return
    setAuthResolved(true)
    setUser(next)
    if (next) {
      setStatus('signed-in')
      void startSyncing(next.uid)
    } else {
      generationRef.current++
      stopSyncing()
      setStatus('signed-out')
    }
  }

  /** (Re)attaches the auth-state listener against whatever config is currently saved. */
  async function attachAuthWatch() {
    if (!hasFirebaseConfig()) {
      setAuthResolved(true)
      return
    }
    const mod = await import('../services/sync/firebase')
    if (!mountedRef.current) return
    try {
      await mod.completeRedirectSignIn()
    } catch (err) {
      console.error('[sync] redirect sign-in failed', err)
    }
    if (!mountedRef.current) return
    const unsub = await mod.watchAuth(handleAuthChange)
    if (!mountedRef.current) {
      unsub()
      return
    }
    authUnsubRef.current?.()
    authUnsubRef.current = unsub
  }

  useEffect(() => {
    mountedRef.current = true
    void attachAuthWatch()
    return () => {
      mountedRef.current = false
      authUnsubRef.current?.()
      authUnsubRef.current = null
      syncHandleRef.current?.stop()
      syncHandleRef.current = null
    }
    // Runs once on mount; connect()/disconnect() manage re-attachment explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-pull from the cloud whenever the app returns to the foreground or the
  // network comes back. Mobile PWAs (esp. iOS) freeze the process when you switch
  // away — killing Firestore's realtime channel — and on resume they often reuse
  // the frozen process without re-running sign-in, so a cloud write made while the
  // phone was asleep (like an hourly Garmin push) would otherwise never arrive.
  useEffect(() => {
    if (status !== 'signed-in') return
    let last = 0
    const trigger = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
      const now = Date.now()
      if (now - last < 3000) return // collapse the focus+visibility double-fire
      last = now
      void refresh()
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') trigger()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', trigger)
    window.addEventListener('online', trigger)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', trigger)
      window.removeEventListener('online', trigger)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  async function signIn() {
    setStatus('signing-in')
    try {
      const { signInWithGoogle } = await import('../services/sync/firebase')
      await signInWithGoogle()
      // signInWithPopup resolves into watchAuth's callback (status flips there);
      // signInWithRedirect navigates away, so nothing further runs in that path.
    } catch (err) {
      console.error('[sync] sign-in failed', err)
      if (mountedRef.current) setStatus('signed-out')
    }
  }

  async function emailSignIn(mode: 'signin' | 'signup', email: string, password: string) {
    setStatus('signing-in')
    try {
      const { emailPasswordSignIn } = await import('../services/sync/firebase')
      await emailPasswordSignIn(mode, email.trim(), password)
      // watchAuth's onAuthStateChanged callback flips status to 'signed-in'.
    } catch (err) {
      if (mountedRef.current) setStatus('signed-out')
      throw err
    }
  }

  async function resetPassword(email: string) {
    const { sendPasswordReset } = await import('../services/sync/firebase')
    await sendPasswordReset(email.trim())
  }

  async function signOut() {
    try {
      const { signOutUser } = await import('../services/sync/firebase')
      await signOutUser()
      // watchAuth's callback flips user/status/syncState back to signed-out/idle.
    } catch (err) {
      console.error('[sync] sign-out failed', err)
    }
  }

  function connect(pastedConfig: string): boolean {
    const cfg = parseFirebaseConfig(pastedConfig)
    if (!cfg) return false

    saveFirebaseConfig(cfg)
    setConfigured(true)
    setUsingOwnProject(true)

    // Re-init in place (no page reload): tear down any previous Firebase app
    // instance, then reattach the auth watcher against the freshly saved config.
    void (async () => {
      generationRef.current++
      stopSyncing()
      authUnsubRef.current?.()
      authUnsubRef.current = null
      if (mountedRef.current) {
        setUser(null)
        setStatus('signed-out')
      }
      try {
        const { resetFirebase } = await import('../services/sync/firebase')
        await resetFirebase()
      } catch (err) {
        console.error('[sync] reset before reconnect failed', err)
      }
      await attachAuthWatch()
    })()

    return true
  }

  /**
   * Forgets the config this device pasted. When a built-in default exists the
   * app falls straight back onto it (so this reads as "stop using my own
   * project"); with no default it returns to the paste screen.
   */
  function disconnect() {
    void (async () => {
      generationRef.current++
      stopSyncing()
      authUnsubRef.current?.()
      authUnsubRef.current = null
      try {
        const { signOutUser, resetFirebase } = await import('../services/sync/firebase')
        await signOutUser().catch(() => {})
        await resetFirebase()
      } catch (err) {
        console.error('[sync] disconnect cleanup failed', err)
      }
      clearFirebaseConfig()
      if (mountedRef.current) {
        setUser(null)
        setStatus('signed-out')
        setSyncState('idle')
        // Re-derive rather than assuming false: the baked-in default may still
        // leave the app configured, and claiming otherwise strands the UI on a
        // paste screen that a reload would immediately contradict.
        setConfigured(hasFirebaseConfig())
        setUsingOwnProject(false)
      }
      // Re-attach against the default config (no-op when there isn't one).
      await attachAuthWatch()
    })()
  }

  const value: AuthContextValue = {
    user,
    status,
    syncState,
    configured,
    usingOwnProject,
    authResolved,
    lastSyncedAt,
    signIn,
    emailSignIn,
    resetPassword,
    signOut,
    refresh,
    connect,
    disconnect,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// Cross-device sync glue: wraps the app in an auth/sync context backed by
// Firebase (Google sign-in + Firestore), but stays entirely inert — renders
// children untouched, status stays 'signed-out' — when no Firebase config has
// been pasted into Settings. Every Firebase-touching import below is dynamic
// so the SDK stays out of the app's main entry chunk until it's actually needed.

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  hasFirebaseConfig,
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
  signIn: () => Promise<void>
  signOut: () => Promise<void>
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
    } catch (err) {
      console.error('[sync] failed to start sync', err)
      if (generation === generationRef.current) setSyncState('error')
    }
  }

  function handleAuthChange(next: SyncUser | null) {
    if (!mountedRef.current) return
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
    if (!hasFirebaseConfig()) return
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
        setConfigured(false)
      }
    })()
  }

  const value: AuthContextValue = {
    user,
    status,
    syncState,
    configured,
    signIn,
    signOut,
    connect,
    disconnect,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

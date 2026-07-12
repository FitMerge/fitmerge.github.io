// Lazy Firebase glue. Every Firebase SDK import here is a dynamic `import()`
// so that `firebase/*` never ends up in the main entry chunk — bundlers only
// pull it in (as a separate chunk) once one of these functions actually runs,
// which only happens when the user has pasted a config and/or signed in.
//
// The `import type` statements below are compile-time only (TypeScript erases
// them entirely — no runtime `import`), so they give us real types without
// affecting the bundle.

import type { FirebaseApp } from 'firebase/app'
import type { Auth } from 'firebase/auth'
import type { Firestore } from 'firebase/firestore'
import { loadFirebaseConfig, type FirebaseConfig } from './firebaseConfig'

type FirebaseHandle = { auth: Auth; db: Firestore }

export type SyncUser = { uid: string; email: string | null }

let cached: Promise<FirebaseHandle | null> | null = null
let cachedApp: FirebaseApp | null = null

/**
 * Initializes (once) and returns the Firebase auth + Firestore handles, or
 * null if no config has been saved yet. Safe to call repeatedly — subsequent
 * calls reuse the same in-flight/completed init.
 */
export async function getFirebase(): Promise<FirebaseHandle | null> {
  const config = loadFirebaseConfig()
  if (!config) return null

  if (!cached) {
    cached = initFirebase(config)
  }
  return cached
}

/**
 * Drop the cached handle (and tear down the underlying Firebase app, if one
 * was created) so the next getFirebase() call re-initializes cleanly. Used
 * after connect/disconnect so switching config works without a page reload.
 */
export async function resetFirebase(): Promise<void> {
  cached = null
  const app = cachedApp
  cachedApp = null
  if (app) {
    try {
      const { deleteApp } = await import('firebase/app')
      await deleteApp(app)
    } catch {
      // Best-effort teardown; a stale app instance is harmless if this fails.
    }
  }
}

async function initFirebase(config: FirebaseConfig): Promise<FirebaseHandle> {
  const { initializeApp, getApps, getApp } = await import('firebase/app')
  const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(config)
  cachedApp = app

  const { getAuth } = await import('firebase/auth')
  const auth = getAuth(app)

  const db = await initFirestore(app)

  return { auth, db }
}

async function initFirestore(app: FirebaseApp): Promise<Firestore> {
  const { initializeFirestore, persistentLocalCache, getFirestore } = await import('firebase/firestore')
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({}),
    })
  } catch {
    // Persistence unavailable (private browsing, multiple tabs w/o coordination, etc.)
    // — fall back to a plain (memory-cached) Firestore instance.
    return getFirestore(app)
  }
}

export async function signInWithGoogle(): Promise<void> {
  const handle = await getFirebase()
  if (!handle) throw new Error('Firebase is not configured')

  const { GoogleAuthProvider, signInWithPopup, signInWithRedirect } = await import('firebase/auth')
  const provider = new GoogleAuthProvider()

  try {
    await signInWithPopup(handle.auth, provider)
  } catch (err) {
    if (isPopupError(err)) {
      await signInWithRedirect(handle.auth, provider)
      return
    }
    throw err
  }
}

function isPopupError(err: unknown): boolean {
  return extractErrorCode(err).includes('popup')
}

function extractErrorCode(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = (err as { code: unknown }).code
    if (typeof code === 'string') return code
  }
  return ''
}

export async function completeRedirectSignIn(): Promise<void> {
  const handle = await getFirebase()
  if (!handle) return
  const { getRedirectResult } = await import('firebase/auth')
  await getRedirectResult(handle.auth)
}

export async function signOutUser(): Promise<void> {
  const handle = await getFirebase()
  if (!handle) return
  const { signOut } = await import('firebase/auth')
  await signOut(handle.auth)
}

/**
 * Subscribes to auth state changes. Returns an unsubscribe function; if
 * Firebase isn't configured, returns a no-op unsubscribe immediately.
 */
export async function watchAuth(cb: (user: SyncUser | null) => void): Promise<() => void> {
  const handle = await getFirebase()
  if (!handle) return () => {}

  const { onAuthStateChanged } = await import('firebase/auth')
  return onAuthStateChanged(handle.auth, (user) => {
    cb(user ? { uid: user.uid, email: user.email ?? null } : null)
  })
}

/** Exposed for firestoreBackend.ts, which needs the raw `db` handle. */
export async function getFirestoreDb(): Promise<Firestore | null> {
  const handle = await getFirebase()
  return handle ? handle.db : null
}

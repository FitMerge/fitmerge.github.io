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

/** `displayName` is kept only to seed a challenge nickname — the challenge board
 * publishes that editable nickname, never the email. */
export type SyncUser = { uid: string; email: string | null; displayName: string | null }

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

  const auth = await initAuth(app)

  const db = await initFirestore(app)

  return { auth, db }
}

/**
 * Initialise Auth with IndexedDB persistence first. This matters for an installed
 * (home-screen) PWA: the Google sign-in there has to go through a full-page
 * redirect (popups are blocked in standalone mode), and the default persistence
 * doesn't reliably survive that round-trip on iOS — the app came back still
 * signed-out. IndexedDB persistence carries the pending auth state across the
 * redirect. Falls back to the default getAuth if initializeAuth isn't usable
 * (e.g. auth was already initialised, or IndexedDB is blocked in private mode).
 */
async function initAuth(app: FirebaseApp): Promise<Auth> {
  const { initializeAuth, getAuth, indexedDBLocalPersistence, browserLocalPersistence, browserPopupRedirectResolver } =
    await import('firebase/auth')
  try {
    return initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence],
      popupRedirectResolver: browserPopupRedirectResolver,
    })
  } catch {
    return getAuth(app)
  }
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

/**
 * Email + password sign-in / sign-up. Unlike Google (popup/redirect) and email-link
 * (which opens in Safari), this completes entirely inside the current webview — the
 * one auth path that actually works in an installed iOS home-screen PWA, where the
 * app's storage is walled off from Safari. onAuthStateChanged fires on success, so
 * the normal watchAuth flow takes it from here.
 */
export async function emailPasswordSignIn(
  mode: 'signin' | 'signup',
  email: string,
  password: string,
): Promise<void> {
  const handle = await getFirebase()
  if (!handle) throw new Error('Firebase is not configured')
  const { signInWithEmailAndPassword, createUserWithEmailAndPassword } = await import('firebase/auth')
  if (mode === 'signup') {
    await createUserWithEmailAndPassword(handle.auth, email, password)
  } else {
    await signInWithEmailAndPassword(handle.auth, email, password)
  }
}

export async function sendPasswordReset(email: string): Promise<void> {
  const handle = await getFirebase()
  if (!handle) throw new Error('Firebase is not configured')
  const { sendPasswordResetEmail } = await import('firebase/auth')
  await sendPasswordResetEmail(handle.auth, email)
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
    cb(user ? { uid: user.uid, email: user.email ?? null, displayName: user.displayName ?? null } : null)
  })
}

/** Exposed for firestoreBackend.ts, which needs the raw `db` handle. */
export async function getFirestoreDb(): Promise<Firestore | null> {
  const handle = await getFirebase()
  return handle ? handle.db : null
}

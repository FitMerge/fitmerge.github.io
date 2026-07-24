// Talks to the two Firestore documents that drive in-app Garmin connection:
//
//   users/{uid}/garmin/cred     write-only from here — the sealed login
//   users/{uid}/garmin/status   read-only from here — progress from the sync job
//
// Nothing in this file can decrypt anything: the browser only ever seals (see
// linkCrypto.ts), and the security rules make `cred` unreadable to the client.
// Firestore imports stay dynamic so the SDK is not pulled into the main bundle.

import { getFirestoreDb } from '../sync/firebase'
import { seal } from './linkCrypto'

export type GarminLinkState =
  | 'idle' // never connected
  | 'pending' // sync job is signing in
  | 'needs_mfa' // waiting for the user's two-factor code
  | 'linked' // connected and syncing
  | 'error'
  | 'needs_relink' // session expired or key rotated

export type GarminStatus = {
  state: GarminLinkState
  message: string
  email?: string
  lastSyncAt: number | null
}

export class GarminLinkError extends Error {}

const IDLE: GarminStatus = { state: 'idle', message: '', lastSyncAt: null }

const VALID_STATES: GarminLinkState[] = ['idle', 'pending', 'needs_mfa', 'linked', 'error', 'needs_relink']

/** Firestore timestamps arrive as {seconds} or a Timestamp; normalise to epoch ms. */
function toMillis(value: unknown): number | null {
  if (!value) return null
  if (typeof value === 'number') return value
  const v = value as { toMillis?: () => number; seconds?: number }
  if (typeof v.toMillis === 'function') return v.toMillis()
  if (typeof v.seconds === 'number') return v.seconds * 1000
  return null
}

export function parseStatus(data: unknown): GarminStatus {
  if (!data || typeof data !== 'object') return IDLE
  const d = data as Record<string, unknown>
  const state = typeof d.state === 'string' && (VALID_STATES as string[]).includes(d.state)
    ? (d.state as GarminLinkState)
    : 'idle'
  return {
    state,
    message: typeof d.message === 'string' ? d.message : '',
    email: typeof d.email === 'string' ? d.email : undefined,
    lastSyncAt: toMillis(d.lastSyncAt),
  }
}

async function docRefs(uid: string) {
  const db = await getFirestoreDb()
  if (!db) throw new GarminLinkError('Sign in first to connect Garmin.')
  const { doc } = await import('firebase/firestore')
  return {
    db,
    cred: doc(db, 'users', uid, 'garmin', 'cred'),
    status: doc(db, 'users', uid, 'garmin', 'status'),
  }
}

/** Live updates as the sync job works through the connection. */
export async function subscribeStatus(
  uid: string,
  onChange: (status: GarminStatus) => void,
): Promise<() => void> {
  const db = await getFirestoreDb()
  if (!db) return () => {}
  const { doc, onSnapshot } = await import('firebase/firestore')
  return onSnapshot(
    doc(db, 'users', uid, 'garmin', 'status'),
    (snap) => onChange(snap.exists() ? parseStatus(snap.data()) : IDLE),
    (err) => {
      console.error('[garmin] status subscription failed', err)
      onChange({ state: 'error', message: 'Lost connection — check back in a moment.', lastSyncAt: null })
    },
  )
}

/**
 * Hand the sync job a sealed Garmin login. The password is encrypted in this
 * browser and is replaced by a session token as soon as the first sign-in
 * succeeds, so it only exists — as ciphertext — until then.
 */
export async function submitCredentials(
  uid: string,
  email: string,
  password: string,
  backfillDays = 90,
): Promise<void> {
  if (!email.trim() || !password) throw new GarminLinkError('Enter your Garmin email and password.')
  const secret = await seal(JSON.stringify({ email: email.trim(), password }))
  const { cred } = await docRefs(uid)
  const { setDoc, serverTimestamp } = await import('firebase/firestore')

  // Only `cred` is written here — `status` belongs to the sync job, and the
  // security rules reject client writes to it.
  await setDoc(cred, { secret, kind: 'password', backfillDays, requestedAt: serverTimestamp() })
}

/** Pass along the two-factor code the job is waiting on. */
export async function submitMfaCode(uid: string, code: string): Promise<void> {
  const trimmed = code.trim()
  if (!trimmed) throw new GarminLinkError('Enter the code Garmin sent you.')
  const sealed = await seal(JSON.stringify({ code: trimmed }))
  const { cred } = await docRefs(uid)
  const { setDoc } = await import('firebase/firestore')
  await setDoc(cred, { mfaSecret: sealed }, { merge: true })
}

/** Ask for an out-of-schedule sync. Picked up by the next scheduled run. */
export async function requestPull(uid: string): Promise<void> {
  const { cred } = await docRefs(uid)
  const { setDoc, serverTimestamp } = await import('firebase/firestore')
  await setDoc(cred, { pullRequestedAt: serverTimestamp() }, { merge: true })
}

/** Forget the stored Garmin session. Syncing stops immediately. */
export async function disconnectGarmin(uid: string): Promise<void> {
  const { cred, status } = await docRefs(uid)
  const { deleteDoc } = await import('firebase/firestore')
  await deleteDoc(cred)
  // Clear the job's progress doc too, or the UI would keep reporting "connected"
  // with nothing behind it.
  await deleteDoc(status).catch(() => {})
}

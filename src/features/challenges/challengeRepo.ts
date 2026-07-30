// Every Firestore call the challenge feature makes lives here.
//
// `firebase/firestore` is imported dynamically inside each function, exactly as
// src/services/sync/firebase.ts does, so none of it lands in the entry chunk —
// someone who never opens a challenge never downloads the SDK for it.
//
// This is separate from the store-sync backend on purpose. That layer moves one
// opaque JSON blob per user; challenges need small, shared, queryable-by-id
// documents that other people can read, which is a different shape entirely.

import { getFirestoreDb } from '../../services/sync/firebase'
import type { Challenge, ScoreDays } from './scoring'

export type MemberDoc = {
  displayName: string
  joinedAt: number
  leftAt?: number
  /** IANA zone, kept only so the UI can explain why two people are on different days. */
  tz?: string
  /** Habit names and weights — published so the board can show what someone committed to. */
  habits: { name: string; weight: number }[]
}

export type ScoreDoc = {
  days: ScoreDays
  updatedAt: number
}

export type BoardSnapshot = {
  members: Record<string, MemberDoc>
  scores: Record<string, ScoreDoc>
}

export type InviteDoc = {
  email: string
  invitedAt: number
  invitedBy: string
}

/** Thrown with a message that is safe (and useful) to show the user. */
export class ChallengeError extends Error {}

/**
 * Refused by the security rules. Challenges are invite-only, so this is now the
 * expected outcome of trying to open one you weren't invited to — callers show
 * a different message for it than for a genuine failure.
 */
export class ChallengeAccessError extends ChallengeError {}

function friendly(err: unknown, fallback: string): ChallengeError {
  const code = err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : ''
  if (code.includes('permission-denied')) {
    return new ChallengeAccessError(
      'You don’t have access to that challenge. Ask the organiser to invite your email address.',
    )
  }
  if (code.includes('unavailable')) {
    return new ChallengeError("Can't reach the server. This will retry when you're back online.")
  }
  return new ChallengeError(fallback)
}

async function db() {
  const handle = await getFirestoreDb()
  if (!handle) throw new ChallengeError('Sign in to use challenges.')
  return handle
}

/**
 * Create the challenge document. The code is the document id, so `createDoc`
 * with `{ exists: false }` semantics matters — but Firestore has no conditional
 * create from the client, so we read first. A collision is astronomically
 * unlikely; this catches it rather than silently overwriting someone's board.
 */
export async function createChallenge(c: Challenge, ownerEmail: string): Promise<void> {
  const firestore = await db()
  const { doc, getDoc, setDoc, serverTimestamp } = await import('firebase/firestore')
  const ref = doc(firestore, 'challenges', c.code)
  try {
    const existing = await getDoc(ref)
    if (existing.exists()) {
      throw new ChallengeError('That code is already taken — try creating it again.')
    }
    await setDoc(ref, {
      name: c.name,
      ownerUid: c.ownerUid,
      startDate: c.startDate,
      endDate: c.endDate,
      periodDays: c.periodDays,
      bonusPct: c.bonusPct,
      archived: false,
      // The rules require this to equal request.time, which is also what stops
      // anyone backdating a challenge.
      createdAt: serverTimestamp(),
    })

    // Put the organiser on their own guest list immediately. Writing a member
    // or score document requires being invited, so skipping this would leave
    // whoever created the challenge unable to score in it.
    if (ownerEmail) {
      await setDoc(doc(firestore, 'challenges', c.code, 'invites', ownerEmail), {
        email: ownerEmail,
        invitedAt: Date.now(),
        invitedBy: c.ownerUid,
      })
    }
  } catch (err) {
    if (err instanceof ChallengeError) throw err
    throw friendly(err, "Couldn't create the challenge.")
  }
}

export async function fetchChallenge(code: string): Promise<Challenge | null> {
  const firestore = await db()
  const { doc, getDoc } = await import('firebase/firestore')
  try {
    const snap = await getDoc(doc(firestore, 'challenges', code))
    if (!snap.exists()) return null
    const data = snap.data()
    return {
      code,
      name: String(data.name ?? 'Challenge'),
      ownerUid: String(data.ownerUid ?? ''),
      startDate: String(data.startDate ?? ''),
      endDate: String(data.endDate ?? ''),
      periodDays: (data.periodDays === 7 || data.periodDays === 28 ? data.periodDays : 0) as 0 | 7 | 28,
      bonusPct: typeof data.bonusPct === 'number' ? data.bonusPct : 0,
      archived: data.archived === true,
    }
  } catch (err) {
    throw friendly(err, "Couldn't look that code up.")
  }
}

export async function upsertMember(code: string, uid: string, member: MemberDoc): Promise<void> {
  const firestore = await db()
  const { doc, setDoc } = await import('firebase/firestore')
  try {
    const payload: Record<string, unknown> = {
      displayName: member.displayName,
      joinedAt: member.joinedAt,
      habits: member.habits,
    }
    // Firestore rejects undefined, and the rules use hasOnly() — so optional
    // fields have to be omitted rather than written as undefined.
    if (member.tz) payload.tz = member.tz
    if (member.leftAt !== undefined) payload.leftAt = member.leftAt
    await setDoc(doc(firestore, 'challenges', code, 'members', uid), payload)
  } catch (err) {
    throw friendly(err, "Couldn't save your place in the challenge.")
  }
}

/**
 * Publish the score.
 *
 * `setDoc`, never `updateDoc`: `days` is a full recomputation, so last-write-wins
 * is the correct semantic. It also means a write queued while offline can land
 * after a newer one without corrupting anything — the loser is simply a complete,
 * slightly older picture.
 */
export async function writeScore(code: string, uid: string, days: ScoreDays): Promise<void> {
  const firestore = await db()
  const { doc, setDoc, serverTimestamp } = await import('firebase/firestore')
  try {
    await setDoc(doc(firestore, 'challenges', code, 'scores', uid), {
      days,
      updatedAt: serverTimestamp(),
    })
  } catch (err) {
    throw friendly(err, "Couldn't publish your score.")
  }
}

function toMillis(value: unknown): number {
  if (typeof value === 'number') return value
  if (value && typeof value === 'object' && 'toMillis' in value) {
    const fn = (value as { toMillis: unknown }).toMillis
    if (typeof fn === 'function') return (fn as () => number).call(value)
  }
  return 0
}

/**
 * Live board. Two listeners, one per subcollection, merged into a single
 * callback so the consumer never renders a half-updated board.
 *
 * Note this does NOT filter out our own pending writes the way
 * FirestoreBackend.subscribe does — see useChallengeBoard for why the caller
 * takes its own row from local state instead.
 */
export async function watchBoard(
  code: string,
  onChange: (snapshot: BoardSnapshot) => void,
  onError: (err: ChallengeError) => void,
): Promise<() => void> {
  const firestore = await db()
  const { collection, onSnapshot } = await import('firebase/firestore')

  const state: BoardSnapshot = { members: {}, scores: {} }
  const emit = () => onChange({ members: { ...state.members }, scores: { ...state.scores } })

  const fail = (err: unknown) => onError(friendly(err, "Lost contact with the challenge board."))

  const stopMembers = onSnapshot(
    collection(firestore, 'challenges', code, 'members'),
    (snap) => {
      const next: Record<string, MemberDoc> = {}
      snap.forEach((docSnap) => {
        const d = docSnap.data()
        next[docSnap.id] = {
          displayName: String(d.displayName ?? 'Someone'),
          joinedAt: toMillis(d.joinedAt),
          leftAt: d.leftAt === undefined ? undefined : toMillis(d.leftAt),
          tz: typeof d.tz === 'string' ? d.tz : undefined,
          habits: Array.isArray(d.habits)
            ? d.habits.map((h: { name?: unknown; weight?: unknown }) => ({
                name: String(h?.name ?? ''),
                weight: typeof h?.weight === 'number' ? h.weight : 0,
              }))
            : [],
        }
      })
      state.members = next
      emit()
    },
    fail,
  )

  const stopScores = onSnapshot(
    collection(firestore, 'challenges', code, 'scores'),
    (snap) => {
      const next: Record<string, ScoreDoc> = {}
      snap.forEach((docSnap) => {
        const d = docSnap.data()
        const days = d.days
        next[docSnap.id] = {
          days: days && typeof days === 'object' ? (days as ScoreDays) : {},
          updatedAt: toMillis(d.updatedAt),
        }
      })
      state.scores = next
      emit()
    },
    fail,
  )

  return () => {
    stopMembers()
    stopScores()
  }
}

/**
 * Leaving marks the member document rather than deleting it, so the board keeps
 * your final standing — somebody who is losing shouldn't be able to erase the
 * evidence by walking away.
 */
export async function leaveChallenge(code: string, uid: string, member: MemberDoc): Promise<void> {
  await upsertMember(code, uid, { ...member, leftAt: Date.now() })
}

/** The escape hatch: remove both of your own documents from the challenge. */
export async function removeMyData(code: string, uid: string): Promise<void> {
  const firestore = await db()
  const { doc, deleteDoc } = await import('firebase/firestore')
  try {
    await deleteDoc(doc(firestore, 'challenges', code, 'scores', uid))
    await deleteDoc(doc(firestore, 'challenges', code, 'members', uid))
  } catch (err) {
    throw friendly(err, "Couldn't remove your data.")
  }
}

// --- the guest list --------------------------------------------------------
//
// The invite document's ID is the invited email address. That is what lets the
// security rule decide access with one exists() and no query, and it means
// somebody can be invited before they have ever signed in. Addresses must be
// normalized (see invites.ts) or they won't match the auth token.

/**
 * Add someone to the guest list. Safe to call for an address already on it —
 * this is a plain overwrite, so re-inviting is a no-op rather than an error.
 */
export async function inviteEmail(code: string, email: string, invitedBy: string): Promise<void> {
  const firestore = await db()
  const { doc, setDoc } = await import('firebase/firestore')
  try {
    await setDoc(doc(firestore, 'challenges', code, 'invites', email), {
      email,
      invitedAt: Date.now(),
      invitedBy,
    })
  } catch (err) {
    throw friendly(err, `Couldn't invite ${email}.`)
  }
}

/**
 * Remove someone. Their member and score documents stay put — the rules stop
 * them writing anything further, but deleting their history would silently
 * rewrite the board for everyone else.
 */
export async function revokeInvite(code: string, email: string): Promise<void> {
  const firestore = await db()
  const { doc, deleteDoc } = await import('firebase/firestore')
  try {
    await deleteDoc(doc(firestore, 'challenges', code, 'invites', email))
  } catch (err) {
    throw friendly(err, `Couldn't remove ${email}.`)
  }
}

export async function watchInvites(
  code: string,
  onChange: (invites: InviteDoc[]) => void,
  onError: (err: ChallengeError) => void,
): Promise<() => void> {
  const firestore = await db()
  const { collection, onSnapshot } = await import('firebase/firestore')
  return onSnapshot(
    collection(firestore, 'challenges', code, 'invites'),
    (snap) => {
      const list: InviteDoc[] = []
      snap.forEach((docSnap) => {
        const d = docSnap.data()
        list.push({
          // The document ID is authoritative: it is what the rule matches on.
          email: docSnap.id,
          invitedAt: typeof d.invitedAt === 'number' ? d.invitedAt : 0,
          invitedBy: String(d.invitedBy ?? ''),
        })
      })
      list.sort((a, b) => a.invitedAt - b.invitedAt)
      onChange(list)
    },
    (err) => onError(friendly(err, "Couldn't load the guest list.")),
  )
}

/**
 * Owners archive rather than delete: Firestore has no cascading delete without
 * the Admin SDK, and there is no privileged server on this project.
 */
export async function archiveChallenge(code: string): Promise<void> {
  const firestore = await db()
  const { doc, updateDoc } = await import('firebase/firestore')
  try {
    await updateDoc(doc(firestore, 'challenges', code), { archived: true })
  } catch (err) {
    throw friendly(err, "Couldn't archive the challenge.")
  }
}

export async function renameChallenge(code: string, name: string): Promise<void> {
  const firestore = await db()
  const { doc, updateDoc } = await import('firebase/firestore')
  try {
    await updateDoc(doc(firestore, 'challenges', code), { name })
  } catch (err) {
    throw friendly(err, "Couldn't rename the challenge.")
  }
}

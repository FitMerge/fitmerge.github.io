// Security-rules tests, run against a real Firestore emulator.
//
// These exist because firestore.rules IS the access control for challenges —
// nothing in the React app can enforce who reads a board, and there is no server
// to fall back on. The rules also can't be reasoned about reliably by reading
// them: exists() lookups, request.auth.token.email, and the frozen-field diff()
// all have edge cases that only show up when executed.
//
// Every test names a property worth protecting rather than a line of the rules,
// so they stay meaningful if the implementation is rewritten.
//
// Run with `npm run test:rules` (starts the emulator around this file).

import { readFileSync } from 'node:fs'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { deleteDoc, doc, getDoc, getDocs, collection, serverTimestamp, setDoc } from 'firebase/firestore'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

const CODE = 'AB34CD78'

const OWNER = { uid: 'owner-uid', email: 'owner@example.com' }
const GUEST = { uid: 'guest-uid', email: 'guest@example.com' }
const STRANGER = { uid: 'stranger-uid', email: 'stranger@example.com' }

let env: RulesTestEnvironment

/** A signed-in Firestore handle carrying the email the rules match invites on. */
function as(user: { uid: string; email: string }) {
  return env.authenticatedContext(user.uid, { email: user.email }).firestore()
}

function anonymous() {
  return env.unauthenticatedContext().firestore()
}

function validChallenge(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Iron August',
    ownerUid: OWNER.uid,
    startDate: '2026-08-01',
    endDate: '2026-08-30',
    periodDays: 0,
    bonusPct: 0.1,
    archived: false,
    createdAt: serverTimestamp(),
    ...overrides,
  }
}

function validMember(overrides: Record<string, unknown> = {}) {
  return {
    displayName: 'Guest',
    joinedAt: 1_700_000_000_000,
    tz: 'Europe/London',
    habits: [{ name: 'Workout', weight: 100 }],
    ...overrides,
  }
}

function validScore(overrides: Record<string, unknown> = {}) {
  return {
    days: { '2026-08-01': { done: 1, total: 1, points: 110 } },
    updatedAt: serverTimestamp(),
    ...overrides,
  }
}

/** Seed documents bypassing the rules, the way a prior legitimate write would. */
async function seed(fn: (db: ReturnType<RulesTestEnvironment['authenticatedContext']>['firestore']) => Promise<void>) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await fn(ctx.firestore() as never)
  })
}

/** The state most tests start from: a challenge that exists, with GUEST invited. */
async function seedChallengeWithGuest() {
  await seed(async (db) => {
    await setDoc(doc(db, 'challenges', CODE), validChallenge({ createdAt: new Date() }))
    await setDoc(doc(db, 'challenges', CODE, 'invites', OWNER.email), { email: OWNER.email, invitedAt: 1, invitedBy: OWNER.uid })
    await setDoc(doc(db, 'challenges', CODE, 'invites', GUEST.email), { email: GUEST.email, invitedAt: 2, invitedBy: OWNER.uid })
  })
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-fitmerge',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  })
})

afterAll(async () => {
  await env?.cleanup()
})

afterEach(async () => {
  await env.clearFirestore()
})

// ---------------------------------------------------------------------------

describe('who can see a challenge', () => {
  it('lets an invited person read it', async () => {
    await seedChallengeWithGuest()
    await assertSucceeds(getDoc(doc(as(GUEST), 'challenges', CODE)))
  })

  // The whole point of the invite list: knowing the code is not enough.
  it('refuses someone who has the exact code but no invite', async () => {
    await seedChallengeWithGuest()
    await assertFails(getDoc(doc(as(STRANGER), 'challenges', CODE)))
  })

  it('refuses a signed-out visitor', async () => {
    await seedChallengeWithGuest()
    await assertFails(getDoc(doc(anonymous(), 'challenges', CODE)))
  })

  // The owner is matched on ownerUid rather than through the invite list, so a
  // self-invite that never landed can't lock them out of their own challenge.
  it('lets the owner in even with no invite document for them', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'challenges', CODE), validChallenge({ createdAt: new Date() }))
    })
    await assertSucceeds(getDoc(doc(as(OWNER), 'challenges', CODE)))
  })

  // `allow list: if false` — otherwise anyone could enumerate every challenge
  // in the project and read boards they were never given a code for.
  it('refuses to list the challenges collection', async () => {
    await seedChallengeWithGuest()
    await assertFails(getDocs(collection(as(GUEST), 'challenges')))
  })

  it('stops matching once an invite is revoked', async () => {
    await seedChallengeWithGuest()
    await assertSucceeds(getDoc(doc(as(GUEST), 'challenges', CODE)))
    await seed(async (db) => {
      await deleteDoc(doc(db, 'challenges', CODE, 'invites', GUEST.email))
    })
    await assertFails(getDoc(doc(as(GUEST), 'challenges', CODE)))
  })

  // The invite document ID is the email, and the rule matches it against
  // request.auth.token.email verbatim — so a capitalised invite is a dead one.
  // This is why the app lowercases every address before writing it.
  it('does not match an invite stored with different capitalisation', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'challenges', CODE), validChallenge({ createdAt: new Date() }))
      await setDoc(doc(db, 'challenges', CODE, 'invites', 'Guest@Example.com'), {
        email: 'Guest@Example.com',
        invitedAt: 1,
        invitedBy: OWNER.uid,
      })
    })
    await assertFails(getDoc(doc(as(GUEST), 'challenges', CODE)))
  })
})

describe('who can see the board', () => {
  it('lets an invited person read members and scores', async () => {
    await seedChallengeWithGuest()
    await assertSucceeds(getDocs(collection(as(GUEST), 'challenges', CODE, 'members')))
    await assertSucceeds(getDocs(collection(as(GUEST), 'challenges', CODE, 'scores')))
  })

  it('refuses an uninvited person, even holding the code', async () => {
    await seedChallengeWithGuest()
    await assertFails(getDocs(collection(as(STRANGER), 'challenges', CODE, 'members')))
    await assertFails(getDocs(collection(as(STRANGER), 'challenges', CODE, 'scores')))
  })

  it('lets invited people see who else was invited', async () => {
    await seedChallengeWithGuest()
    await assertSucceeds(getDocs(collection(as(GUEST), 'challenges', CODE, 'invites')))
  })

  it('hides the guest list from an uninvited person', async () => {
    await seedChallengeWithGuest()
    await assertFails(getDocs(collection(as(STRANGER), 'challenges', CODE, 'invites')))
  })
})

describe('managing the guest list', () => {
  it('lets the organiser invite someone', async () => {
    await seedChallengeWithGuest()
    await assertSucceeds(
      setDoc(doc(as(OWNER), 'challenges', CODE, 'invites', STRANGER.email), {
        email: STRANGER.email,
        invitedAt: 3,
        invitedBy: OWNER.uid,
      }),
    )
  })

  it('lets the organiser remove someone', async () => {
    await seedChallengeWithGuest()
    await assertSucceeds(deleteDoc(doc(as(OWNER), 'challenges', CODE, 'invites', GUEST.email)))
  })

  // A member inviting their own friends would let the guest list grow without
  // the organiser's knowledge — the opposite of what invite-only is for.
  it('stops an ordinary member inviting anyone', async () => {
    await seedChallengeWithGuest()
    await assertFails(
      setDoc(doc(as(GUEST), 'challenges', CODE, 'invites', STRANGER.email), {
        email: STRANGER.email,
        invitedAt: 3,
        invitedBy: GUEST.uid,
      }),
    )
  })

  it('stops a member removing someone else', async () => {
    await seedChallengeWithGuest()
    await assertFails(deleteDoc(doc(as(GUEST), 'challenges', CODE, 'invites', OWNER.email)))
  })

  it('stops an outsider inviting themselves', async () => {
    await seedChallengeWithGuest()
    await assertFails(
      setDoc(doc(as(STRANGER), 'challenges', CODE, 'invites', STRANGER.email), {
        email: STRANGER.email,
        invitedAt: 3,
        invitedBy: STRANGER.uid,
      }),
    )
  })
})

describe('scores', () => {
  it('lets an invited member write their own score', async () => {
    await seedChallengeWithGuest()
    await assertSucceeds(setDoc(doc(as(GUEST), 'challenges', CODE, 'scores', GUEST.uid), validScore()))
  })

  // The single most important guarantee in the file. Scores are self-reported,
  // so the one thing the rules must enforce is that you can only report YOUR own.
  it('stops anyone writing someone else’s score', async () => {
    await seedChallengeWithGuest()
    await assertFails(setDoc(doc(as(GUEST), 'challenges', CODE, 'scores', OWNER.uid), validScore()))
  })

  it('stops an uninvited person writing a score at all', async () => {
    await seedChallengeWithGuest()
    await assertFails(setDoc(doc(as(STRANGER), 'challenges', CODE, 'scores', STRANGER.uid), validScore()))
  })

  it('lets the owner score without relying on their invite document', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'challenges', CODE), validChallenge({ createdAt: new Date() }))
    })
    await assertSucceeds(setDoc(doc(as(OWNER), 'challenges', CODE, 'scores', OWNER.uid), validScore()))
  })

  it('rejects unexpected fields', async () => {
    await seedChallengeWithGuest()
    await assertFails(
      setDoc(doc(as(GUEST), 'challenges', CODE, 'scores', GUEST.uid), validScore({ multiplier: 99 })),
    )
  })

  // Caps the document well below Firestore's 1MB limit: one oversized score
  // document would break the listener for everyone on the board, not just its
  // author.
  it('rejects more than 400 days', async () => {
    await seedChallengeWithGuest()
    const days: Record<string, unknown> = {}
    for (let i = 0; i < 401; i++) {
      days[`day-${i}`] = { done: 1, total: 1, points: 110 }
    }
    await assertFails(setDoc(doc(as(GUEST), 'challenges', CODE, 'scores', GUEST.uid), validScore({ days })))
  })

  it('accepts exactly 400 days', async () => {
    await seedChallengeWithGuest()
    const days: Record<string, unknown> = {}
    for (let i = 0; i < 400; i++) {
      days[`day-${i}`] = { done: 1, total: 1, points: 110 }
    }
    await assertSucceeds(setDoc(doc(as(GUEST), 'challenges', CODE, 'scores', GUEST.uid), validScore({ days })))
  })

  // updatedAt drives the "last logged 6 days ago" staleness hint, which is one
  // of the few honesty signals the board has. A client-chosen value would let
  // someone backfill a month and look current.
  it('rejects a client-chosen updatedAt', async () => {
    await seedChallengeWithGuest()
    await assertFails(
      setDoc(doc(as(GUEST), 'challenges', CODE, 'scores', GUEST.uid), validScore({ updatedAt: 12345 })),
    )
  })

  it('lets a member delete their own score but not anyone else’s', async () => {
    await seedChallengeWithGuest()
    await seed(async (db) => {
      await setDoc(doc(db, 'challenges', CODE, 'scores', GUEST.uid), { days: {}, updatedAt: new Date() })
      await setDoc(doc(db, 'challenges', CODE, 'scores', OWNER.uid), { days: {}, updatedAt: new Date() })
    })
    await assertFails(deleteDoc(doc(as(GUEST), 'challenges', CODE, 'scores', OWNER.uid)))
    await assertSucceeds(deleteDoc(doc(as(GUEST), 'challenges', CODE, 'scores', GUEST.uid)))
  })
})

describe('members', () => {
  it('lets an invited person join', async () => {
    await seedChallengeWithGuest()
    await assertSucceeds(setDoc(doc(as(GUEST), 'challenges', CODE, 'members', GUEST.uid), validMember()))
  })

  it('stops an uninvited person joining', async () => {
    await seedChallengeWithGuest()
    await assertFails(setDoc(doc(as(STRANGER), 'challenges', CODE, 'members', STRANGER.uid), validMember()))
  })

  it('stops anyone writing another person’s member entry', async () => {
    await seedChallengeWithGuest()
    await assertFails(setDoc(doc(as(GUEST), 'challenges', CODE, 'members', OWNER.uid), validMember()))
  })

  it('requires a display name', async () => {
    await seedChallengeWithGuest()
    await assertFails(
      setDoc(doc(as(GUEST), 'challenges', CODE, 'members', GUEST.uid), validMember({ displayName: '' })),
    )
  })

  it('rejects an absurdly long display name', async () => {
    await seedChallengeWithGuest()
    await assertFails(
      setDoc(doc(as(GUEST), 'challenges', CODE, 'members', GUEST.uid), validMember({ displayName: 'x'.repeat(41) })),
    )
  })

  it('rejects more than 20 habits', async () => {
    await seedChallengeWithGuest()
    const habits = Array.from({ length: 21 }, (_, i) => ({ name: `H${i}`, weight: 5 }))
    await assertFails(
      setDoc(doc(as(GUEST), 'challenges', CODE, 'members', GUEST.uid), validMember({ habits })),
    )
  })

  it('rejects unexpected fields', async () => {
    await seedChallengeWithGuest()
    await assertFails(
      setDoc(doc(as(GUEST), 'challenges', CODE, 'members', GUEST.uid), validMember({ isAdmin: true })),
    )
  })
})

describe('creating a challenge', () => {
  it('lets a signed-in person create one they own', async () => {
    await assertSucceeds(setDoc(doc(as(OWNER), 'challenges', CODE), validChallenge()))
  })

  it('stops anyone creating a challenge owned by someone else', async () => {
    await assertFails(setDoc(doc(as(GUEST), 'challenges', CODE), validChallenge()))
  })

  it('refuses a signed-out creator', async () => {
    await assertFails(setDoc(doc(anonymous(), 'challenges', CODE), validChallenge()))
  })

  it('rejects an end date before the start date', async () => {
    await assertFails(
      setDoc(doc(as(OWNER), 'challenges', CODE), validChallenge({ startDate: '2026-08-30', endDate: '2026-08-01' })),
    )
  })

  it('accepts a single-day challenge', async () => {
    await assertSucceeds(
      setDoc(doc(as(OWNER), 'challenges', CODE), validChallenge({ startDate: '2026-08-01', endDate: '2026-08-01' })),
    )
  })

  it('rejects a reset period that is not off, weekly or monthly', async () => {
    await assertFails(setDoc(doc(as(OWNER), 'challenges', CODE), validChallenge({ periodDays: 3 })))
  })

  it('rejects a bonus outside 0–100%', async () => {
    await assertFails(setDoc(doc(as(OWNER), 'challenges', CODE), validChallenge({ bonusPct: 1.5 })))
    await assertFails(setDoc(doc(as(OWNER), 'challenges', CODE), validChallenge({ bonusPct: -0.1 })))
  })

  it('rejects a malformed date', async () => {
    await assertFails(setDoc(doc(as(OWNER), 'challenges', CODE), validChallenge({ startDate: '2026-8-1' })))
  })

  it('rejects an empty or overlong name', async () => {
    await assertFails(setDoc(doc(as(OWNER), 'challenges', CODE), validChallenge({ name: '' })))
    await assertFails(setDoc(doc(as(OWNER), 'challenges', CODE), validChallenge({ name: 'x'.repeat(61) })))
  })

  // Backdating createdAt would misrepresent when a challenge was set up.
  it('rejects a client-chosen creation time', async () => {
    await assertFails(setDoc(doc(as(OWNER), 'challenges', CODE), validChallenge({ createdAt: 12345 })))
  })

  it('rejects unexpected fields', async () => {
    await assertFails(setDoc(doc(as(OWNER), 'challenges', CODE), validChallenge({ secretBonus: 500 })))
  })
})

describe('changing a challenge', () => {
  it('lets the owner rename it', async () => {
    await seedChallengeWithGuest()
    await assertSucceeds(setDoc(doc(as(OWNER), 'challenges', CODE), { name: 'Iron September' }, { merge: true }))
  })

  it('lets the owner archive it', async () => {
    await seedChallengeWithGuest()
    await assertSucceeds(setDoc(doc(as(OWNER), 'challenges', CODE), { archived: true }, { merge: true }))
  })

  // Moving the dates or the bonus after people have banked points would
  // silently revalue everything already earned.
  it('stops the owner moving the goalposts', async () => {
    await seedChallengeWithGuest()
    await assertFails(setDoc(doc(as(OWNER), 'challenges', CODE), { endDate: '2026-12-31' }, { merge: true }))
    await assertFails(setDoc(doc(as(OWNER), 'challenges', CODE), { bonusPct: 0.9 }, { merge: true }))
    await assertFails(setDoc(doc(as(OWNER), 'challenges', CODE), { periodDays: 7 }, { merge: true }))
  })

  it('stops a member renaming it', async () => {
    await seedChallengeWithGuest()
    await assertFails(setDoc(doc(as(GUEST), 'challenges', CODE), { name: 'Hijacked' }, { merge: true }))
  })

  // No cascading delete without an Admin SDK, so a deleted parent would orphan
  // every member and score document. Owners archive instead.
  it('lets nobody delete a challenge, not even its owner', async () => {
    await seedChallengeWithGuest()
    await assertFails(deleteDoc(doc(as(OWNER), 'challenges', CODE)))
  })
})

describe('the rest of the database is untouched', () => {
  it('still keeps one user out of another user’s synced stores', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'users', OWNER.uid, 'state', 'nutrition'), { payload: '{}' })
    })
    await assertFails(getDoc(doc(as(GUEST), 'users', OWNER.uid, 'state', 'nutrition')))
    await assertSucceeds(getDoc(doc(as(OWNER), 'users', OWNER.uid, 'state', 'nutrition')))
  })

  it('still refuses to read back a sealed Garmin credential', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'users', OWNER.uid, 'garmin', 'cred'), { secret: 'sealed', kind: 'tokens' })
    })
    await assertFails(getDoc(doc(as(OWNER), 'users', OWNER.uid, 'garmin', 'cred')))
  })

  it('still denies collections that have no rule of their own', async () => {
    await assertFails(getDoc(doc(as(OWNER), 'somethingNew', 'x')))
  })

  it('now allows the newly synced supplements and challenges stores', async () => {
    await assertSucceeds(setDoc(doc(as(OWNER), 'users', OWNER.uid, 'state', 'supplements'), { payload: '{}' }))
    await assertSucceeds(setDoc(doc(as(OWNER), 'users', OWNER.uid, 'state', 'challenges'), { payload: '{}' }))
  })
})

describe('rules deny cleanly rather than erroring', () => {
  // Firestore evaluates EVERY applicable rule on a write, so the create rule
  // also runs during an update (no createdAt in the payload) and the update
  // rule runs during a create (no existing document). Dereferencing those
  // raises an evaluation error instead of returning false. That still fails
  // closed, so nothing is insecure — but it fills the logs with errors and
  // would hide a genuine one, so the guards are worth keeping.
  it('creates a challenge without tripping the update rule', async () => {
    await assertSucceeds(setDoc(doc(as(OWNER), 'challenges', CODE), validChallenge()))
  })

  it('renames a challenge without tripping the create rule', async () => {
    await seedChallengeWithGuest()
    await assertSucceeds(setDoc(doc(as(OWNER), 'challenges', CODE), { name: 'Renamed' }, { merge: true }))
  })

  it('denies a read of a challenge that does not exist', async () => {
    await assertFails(getDoc(doc(as(STRANGER), 'challenges', 'NOSUCH00')))
  })

  // Reading a challenge you don't belong to is denied, and a challenge that
  // doesn't exist yet has nobody belonging to it — so creation must NOT check
  // whether its code is taken first. It used to, which refused every attempt.
  // This is the regression: the app's real call sequence, not a rule in
  // isolation.
  it('creates without reading the code first, the way the app does', async () => {
    await assertSucceeds(setDoc(doc(as(OWNER), 'challenges', 'FRESH001'), validChallenge()))
  })

  // Which is only safe because a collision can't clobber anyone: writing over
  // an existing challenge is an update, and the update rule allows the owner to
  // change nothing but the name and the archived flag.
  it('cannot overwrite someone else’s challenge by writing to their code', async () => {
    await seedChallengeWithGuest()
    await assertFails(
      setDoc(doc(as(STRANGER), 'challenges', CODE), validChallenge({ ownerUid: STRANGER.uid })),
    )
    // Not even the owner can reset their own challenge's dates this way.
    await assertFails(setDoc(doc(as(OWNER), 'challenges', CODE), validChallenge()))
  })

  it('denies a member write when the parent challenge is missing', async () => {
    await assertFails(setDoc(doc(as(GUEST), 'challenges', 'NOSUCH00', 'members', GUEST.uid), validMember()))
  })
})

// A guard on the test harness itself: if the emulator ever came up without the
// rules loaded, every assertFails above would pass for the wrong reason.
describe('the harness is actually enforcing rules', () => {
  it('denies an unauthenticated read of a protected document', async () => {
    await seedChallengeWithGuest()
    const result = await getDoc(doc(as(GUEST), 'challenges', CODE)).catch(() => null)
    expect(result).not.toBeNull()
    await assertFails(getDoc(doc(anonymous(), 'challenges', CODE)))
  })
})

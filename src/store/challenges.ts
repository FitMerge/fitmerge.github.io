// Challenges the user has joined, cached locally.
//
// The Firestore documents are the source of truth for the shared parts (who is
// in, what everyone scored). This store holds two things that document can't:
// a cached copy of the challenge definition, so the screen renders instantly and
// offline, and the private mapping from the user's OWN daily-checklist habits to
// the weights they carry — which is deliberately kept here rather than tagged
// onto `Supplement`, so the habit engine needs no schema change at all.

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Challenge } from '../features/challenges/scoring'
import type { WeightMap } from '../features/challenges/weights'

export type JoinedChallenge = {
  challenge: Challenge
  joinedAt: number
  /** Local supplement id → percentage of the day. Totals 100 when balanced. */
  weights: WeightMap
  /** Set when the user left; the member document keeps their final standing. */
  leftAt?: number
}

type ChallengeState = {
  joined: JoinedChallenge[]
  /** Name shown to everyone else on the board. Defaults from the Google account. */
  displayName: string
  join: (challenge: Challenge, weights: WeightMap) => void
  leave: (code: string) => void
  /** Forget a challenge entirely — used after removing your data from it. */
  forget: (code: string) => void
  setWeights: (code: string, weights: WeightMap) => void
  /** Refresh the cached definition after a fetch, without touching local weights. */
  cacheChallenge: (challenge: Challenge) => void
  setDisplayName: (name: string) => void
}

export const useChallengeStore = create<ChallengeState>()(
  persist(
    (set, get) => ({
      joined: [],
      displayName: '',
      join: (challenge, weights) => {
        const existing = get().joined.find((j) => j.challenge.code === challenge.code)
        if (existing) {
          // Re-joining one you left: keep the original joinedAt so the board's
          // tie-break (and your history) stay put.
          set({
            joined: get().joined.map((j) =>
              j.challenge.code === challenge.code ? { ...j, challenge, weights, leftAt: undefined } : j,
            ),
          })
          return
        }
        set({ joined: [...get().joined, { challenge, joinedAt: Date.now(), weights }] })
      },
      leave: (code) =>
        set({
          joined: get().joined.map((j) =>
            j.challenge.code === code ? { ...j, leftAt: Date.now() } : j,
          ),
        }),
      forget: (code) => set({ joined: get().joined.filter((j) => j.challenge.code !== code) }),
      setWeights: (code, weights) =>
        set({
          joined: get().joined.map((j) => (j.challenge.code === code ? { ...j, weights } : j)),
        }),
      cacheChallenge: (challenge) =>
        set({
          joined: get().joined.map((j) =>
            j.challenge.code === challenge.code ? { ...j, challenge } : j,
          ),
        }),
      setDisplayName: (displayName) => set({ displayName }),
    }),
    { name: 'fm-challenges' },
  ),
)

/** The challenges worth showing today — joined, not left, not finished. */
export function activeChallenges(joined: JoinedChallenge[], today: string): JoinedChallenge[] {
  return joined.filter(
    (j) => j.leftAt === undefined && !j.challenge.archived && today <= j.challenge.endDate,
  )
}

export function findJoined(joined: JoinedChallenge[], code: string): JoinedChallenge | undefined {
  return joined.find((j) => j.challenge.code === code)
}

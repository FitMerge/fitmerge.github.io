// Live leaderboard for one challenge.
//
// The one subtlety: YOUR row comes from local state, not from the snapshot.
// FirestoreBackend.subscribe blanket-drops snapshots with pending writes, and
// Firestore's own listener does the same for un-acknowledged local writes — so
// taking your own score from the server would make it flicker after every tick,
// and simply not appear at all while offline. Other people's rows have no such
// problem, because their writes are already acknowledged by the time we see them.

import { useEffect, useMemo, useState } from 'react'
import { useSupplementStore, doseFor } from '../../store/supplements'
import { useChallengeStore, findJoined } from '../../store/challenges'
import { useAuth } from '../../auth/AuthProvider'
import { todayISO } from '../../lib/date'
import { pruneWeights } from './weights'
import {
  challengeDates,
  scoreDay,
  standings,
  type BoardMember,
  type Challenge,
  type ScoreDays,
  type StandingRow,
} from './scoring'
import { watchBoard, type BoardSnapshot, type MemberDoc } from './challengeRepo'
import { seedPublishedDays } from './useChallengeScorePush'

export type BoardState = {
  rows: StandingRow[]
  members: Record<string, MemberDoc>
  /** Your own days, computed locally — always current, even offline. */
  myDays: ScoreDays
  loading: boolean
  error: string
}

export function useChallengeBoard(
  challenge: Challenge | null,
  range: { from: string; to: string } | null,
): BoardState {
  const { user } = useAuth()
  const items = useSupplementStore((s) => s.items)
  const log = useSupplementStore((s) => s.log)
  const joined = useChallengeStore((s) => s.joined)

  const [snapshot, setSnapshot] = useState<BoardSnapshot>({ members: {}, scores: {} })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const code = challenge?.code ?? null

  useEffect(() => {
    if (!code) return
    let stop: (() => void) | null = null
    let cancelled = false

    setLoading(true)
    setError('')
    void watchBoard(
      code,
      (next) => {
        if (cancelled) return
        setSnapshot(next)
        setLoading(false)
      },
      (err) => {
        if (cancelled) return
        setError(err.message)
        setLoading(false)
      },
    )
      .then((unsub) => {
        if (cancelled) unsub()
        else stop = unsub
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not open the board.')
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
      stop?.()
    }
  }, [code])

  // Whatever the cloud already holds for us seeds the push hook's carry-forward
  // cache, so days written from another device survive this device's first
  // recompute (which only covers the last week).
  const uid = user?.uid ?? null
  useEffect(() => {
    if (!code || !uid) return
    const mine = snapshot.scores[uid]
    if (mine) seedPublishedDays(code, mine.days)
  }, [code, uid, snapshot])

  const myDays = useMemo<ScoreDays>(() => {
    if (!challenge) return {}
    const entry = findJoined(joined, challenge.code)
    if (!entry) return {}
    const weights = pruneWeights(
      entry.weights,
      items.map((i) => i.id),
    )
    if (Object.keys(weights).length === 0) return {}
    const days: ScoreDays = {}
    for (const date of challengeDates(challenge, todayISO())) {
      days[date] = scoreDay(challenge, weights, (habitId) => doseFor(log, date, habitId) > 0)
    }
    return days
  }, [challenge, joined, items, log])

  const rows = useMemo<StandingRow[]>(() => {
    if (!challenge) return []
    const members: Record<string, BoardMember> = {}
    for (const [memberUid, doc] of Object.entries(snapshot.members)) {
      members[memberUid] = { displayName: doc.displayName, joinedAt: doc.joinedAt, leftAt: doc.leftAt }
    }

    const scores: Record<string, { days: ScoreDays; updatedAt?: number }> = {}
    for (const [memberUid, doc] of Object.entries(snapshot.scores)) {
      scores[memberUid] = { days: doc.days, updatedAt: doc.updatedAt }
    }

    if (uid) {
      // Local always wins for our own row — see the note at the top of the file.
      scores[uid] = { days: myDays, updatedAt: snapshot.scores[uid]?.updatedAt ?? Date.now() }
      // Before the members listener has delivered anything (first paint, or
      // offline) we would otherwise be missing from our own board.
      if (!members[uid]) {
        const entry = findJoined(joined, challenge.code)
        members[uid] = {
          displayName: useChallengeStore.getState().displayName || 'You',
          joinedAt: entry?.joinedAt ?? Date.now(),
        }
      }
    }

    return standings(members, scores, uid, range)
  }, [challenge, snapshot, myDays, uid, range, joined])

  return { rows, members: snapshot.members, myDays, loading, error }
}

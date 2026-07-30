// Publishes the signed-in user's challenge scores.
//
// Mounted once in AppShell, next to useGoalAutoCheck. It watches the daily
// checklist, recomputes the days it is allowed to change, and writes the result
// to each active challenge's score document.
//
// Two things here are load-bearing and easy to get wrong:
//
//  1. THE EQUALITY GUARD. The score derives from `supplements`, `supplements`
//     now syncs, and a cloud→local apply fires store subscribers — so without
//     skipping unchanged writes this is a feedback loop. Spark's free tier is
//     20k writes/day and a loop would burn it in minutes, taking nutrition and
//     workouts sync down with it for the rest of the day.
//
//  2. THE ROLLING WINDOW. Deleting a habit rebuilds the supplement log without
//     it (store/supplements.ts removeItem), so a full recompute would silently
//     restate scores from weeks ago. Only the last few days are recomputed;
//     everything older is carried forward from what was already published.

import { useEffect, useRef } from 'react'
import { useSupplementStore, doseFor } from '../../store/supplements'
import { useChallengeStore, activeChallenges } from '../../store/challenges'
import { useAuth } from '../../auth/AuthProvider'
import { addDays, todayISO } from '../../lib/date'
import { pruneWeights } from './weights'
import { challengeDates, scoreDay, type ScoreDays } from './scoring'
import { writeScore } from './challengeRepo'

/** Longer than the sync layer's 800ms, so a remote snapshot settles first. */
const DEBOUNCE_MS = 2000

/**
 * How far back a recompute may reach. Matches goalAutoCheck's lookback, so a
 * late Garmin pull that backfills a habit still lands in the score.
 */
const RECOMPUTE_DAYS = 7

/**
 * Merge a freshly computed window over the previously published days.
 * Exported for the test suite — this is the rule that stops history moving.
 */
export function mergeWindow(published: ScoreDays, window: ScoreDays, from: string): ScoreDays {
  const out: ScoreDays = {}
  for (const [date, score] of Object.entries(published)) {
    if (date < from) out[date] = score
  }
  return { ...out, ...window }
}

/**
 * Days already published, per challenge code.
 *
 * Module scope rather than a ref because two different hooks touch it: the board
 * listener seeds it with whatever the cloud already holds (which may include days
 * written from another device), and the push hook carries those forward past its
 * recompute window. A ref inside either hook would leave the other blind.
 */
const publishedDays: Record<string, ScoreDays> = {}

/** Called by the board hook once it has seen this user's own score document. */
export function seedPublishedDays(code: string, days: ScoreDays): void {
  if (publishedDays[code] === undefined) publishedDays[code] = days
}

export function useChallengeScorePush(): void {
  const { user, status } = useAuth()
  const items = useSupplementStore((s) => s.items)
  const log = useSupplementStore((s) => s.log)
  const joined = useChallengeStore((s) => s.joined)

  // code → the last payload we successfully wrote, serialized. The guard.
  const lastWritten = useRef<Record<string, string>>({})

  useEffect(() => {
    if (status !== 'signed-in' || !user) return
    const active = activeChallenges(joined, todayISO())
    if (active.length === 0) return

    const timer = setTimeout(() => {
      const today = todayISO()
      const liveIds = items.map((i) => i.id)

      for (const entry of active) {
        const { challenge } = entry
        // Drop weights whose habit was deleted, otherwise their share of the day
        // is unreachable and a perfect day becomes impossible.
        const weights = pruneWeights(entry.weights, liveIds)
        if (Object.keys(weights).length === 0) continue

        const windowStart = addDays(today, -(RECOMPUTE_DAYS - 1))
        const from = windowStart > challenge.startDate ? windowStart : challenge.startDate

        const recomputed: ScoreDays = {}
        for (const date of challengeDates(challenge, today)) {
          if (date < from) continue
          recomputed[date] = scoreDay(challenge, weights, (habitId) => doseFor(log, date, habitId) > 0)
        }

        const days = mergeWindow(publishedDays[challenge.code] ?? {}, recomputed, from)
        const serialized = JSON.stringify(days)
        if (lastWritten.current[challenge.code] === serialized) continue

        // Optimistic: record before the write resolves so a slow round-trip
        // can't queue a duplicate. A failed write clears it so the next change
        // retries rather than assuming success.
        lastWritten.current[challenge.code] = serialized
        publishedDays[challenge.code] = days
        void writeScore(challenge.code, user.uid, days).catch(() => {
          delete lastWritten.current[challenge.code]
        })
      }
    }, DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [status, user, items, log, joined])
}

/** Test seam: forget every cached publication (module state outlives a test). */
export function resetPublishedDays(): void {
  for (const key of Object.keys(publishedDays)) delete publishedDays[key]
}

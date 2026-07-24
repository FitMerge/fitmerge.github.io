import { epley1RM } from '../progress/utils'
import type { SetLog, Units, WorkoutSession } from '../../types'

export const DEFAULT_REST_SEC = 90

/** A working set is any completed set that isn't a warmup. */
export function isWorkingSet(set: SetLog): boolean {
  return set.done && set.type !== 'warmup' && set.weight > 0 && set.reps > 0
}

export function weightUnitLabel(units: Units): string {
  return units === 'imperial' ? 'lb' : 'kg'
}

/** Formats a millisecond duration as mm:ss (or h:mm:ss once past an hour). */
export function formatElapsed(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

/** Finds the most recently used weight for an exercise across finished sessions. */
export function lastWeightForExercise(sessions: WorkoutSession[], exerciseId: string): number {
  const finished = sessions
    .filter((s) => s.finishedAt !== undefined)
    .sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0))

  for (const session of finished) {
    const entry = session.entries.find((e) => e.exerciseId === exerciseId)
    if (!entry || entry.sets.length === 0) continue
    const doneSets = entry.sets.filter((set) => set.done)
    const pool = doneSets.length > 0 ? doneSets : entry.sets
    return pool[pool.length - 1].weight
  }
  return 0
}

export function totalSetsDone(session: WorkoutSession): number {
  return session.entries.reduce((sum, e) => sum + e.sets.filter((s) => s.done).length, 0)
}

export function totalVolume(session: WorkoutSession): number {
  return session.entries.reduce(
    (sum, e) => sum + e.sets.filter(isWorkingSet).reduce((s2, set) => s2 + set.weight * set.reps, 0),
    0,
  )
}

/**
 * The set list for an exercise from the most recent finished session (excluding
 * `excludeSessionId`, typically the in-progress one) — used to show each set's
 * "previous" reference in the logger, Hevy-style.
 */
export function previousSessionSets(
  sessions: WorkoutSession[],
  exerciseId: string,
  excludeSessionId?: string,
): SetLog[] | null {
  const finished = sessions
    .filter((s) => s.finishedAt !== undefined && s.id !== excludeSessionId)
    .sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0))
  for (const session of finished) {
    const entry = session.entries.find((e) => e.exerciseId === exerciseId)
    if (entry && entry.sets.some((s) => s.done)) return entry.sets.filter((s) => s.done)
  }
  return null
}

/** Best est-1RM ever hit on an exercise before `excludeSessionId` — the bar a new PR must clear. */
export function priorBest1RM(
  sessions: WorkoutSession[],
  exerciseId: string,
  excludeSessionId?: string,
): number {
  let best = 0
  for (const session of sessions) {
    if (!session.finishedAt || session.id === excludeSessionId) continue
    const entry = session.entries.find((e) => e.exerciseId === exerciseId)
    if (!entry) continue
    for (const set of entry.sets) {
      if (!isWorkingSet(set)) continue
      best = Math.max(best, epley1RM(set.weight, set.reps))
    }
  }
  return best
}

/** Heaviest single-set weight ever lifted on an exercise before `excludeSessionId`. */
export function priorBestWeight(
  sessions: WorkoutSession[],
  exerciseId: string,
  excludeSessionId?: string,
): number {
  let best = 0
  for (const session of sessions) {
    if (!session.finishedAt || session.id === excludeSessionId) continue
    const entry = session.entries.find((e) => e.exerciseId === exerciseId)
    if (!entry) continue
    for (const set of entry.sets) {
      if (!isWorkingSet(set)) continue
      best = Math.max(best, set.weight)
    }
  }
  return best
}

/** Best single-set volume (weight × reps) ever on an exercise before `excludeSessionId`. */
export function priorBestSetVolume(
  sessions: WorkoutSession[],
  exerciseId: string,
  excludeSessionId?: string,
): number {
  let best = 0
  for (const session of sessions) {
    if (!session.finishedAt || session.id === excludeSessionId) continue
    const entry = session.entries.find((e) => e.exerciseId === exerciseId)
    if (!entry) continue
    for (const set of entry.sets) {
      if (!isWorkingSet(set)) continue
      best = Math.max(best, set.weight * set.reps)
    }
  }
  return best
}

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export function weekdayLabels(): string[] {
  return WEEKDAY_LABELS
}

function parseISOLocal(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

/** e.g. "July 2026" — used to group session history rows by month. */
export function monthYearLabel(iso: string): string {
  return parseISOLocal(iso).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

/** Formats a millisecond duration as a rounded minute count, e.g. "42 min". */
export function formatDurationMin(ms: number): string {
  const min = Math.max(1, Math.round(ms / 60000))
  return `${min} min`
}

/**
 * Duration for a session, in milliseconds. Imported sessions (Apple Health / Garmin / FitMerge
 * JSON) may have no meaningful startedAt/finishedAt gap — an empty routine finished the instant
 * it started — so fall back to the reported durationMin when present.
 */
export function sessionDurationMs(session: WorkoutSession): number {
  if (session.imported && session.durationMin !== undefined) {
    return session.durationMin * 60000
  }
  return (session.finishedAt ?? session.startedAt) - session.startedAt
}

/** Ids of exercises that have at least one completed set in a finished session. */
export function exerciseIdsWithHistory(sessions: WorkoutSession[]): Set<string> {
  const ids = new Set<string>()
  for (const session of sessions) {
    if (!session.finishedAt) continue
    for (const entry of session.entries) {
      if (entry.sets.some((s) => s.done)) ids.add(entry.exerciseId)
    }
  }
  return ids
}

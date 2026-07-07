import type { Units, WorkoutSession } from '../../types'

export const DEFAULT_REST_SEC = 90

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
    (sum, e) => sum + e.sets.filter((s) => s.done).reduce((s2, set) => s2 + set.weight * set.reps, 0),
    0,
  )
}

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export function weekdayLabels(): string[] {
  return WEEKDAY_LABELS
}

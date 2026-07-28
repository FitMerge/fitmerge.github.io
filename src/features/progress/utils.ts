import { addDays, lastNDays, todayISO } from '../../lib/date'
import { totalSetsDone, totalVolume } from '../workouts/utils'
import { convertWeight } from '../../lib/units'
import type { BodyEntry, Units, WorkoutSession } from '../../types'

export { kgToLb, lbToKg, convertWeight, weightUnit } from '../../lib/units'

export type RangeKey = '7d' | '30d' | '90d'

export const RANGE_OPTIONS: { key: RangeKey; label: string; days: number }[] = [
  { key: '7d', label: '7d', days: 7 },
  { key: '30d', label: '30d', days: 30 },
  { key: '90d', label: '90d', days: 90 },
]

export function rangeDays(range: RangeKey): number {
  return RANGE_OPTIONS.find((r) => r.key === range)?.days ?? 30
}

export function rangeStartDate(range: RangeKey): string {
  return addDays(todayISO(), -(rangeDays(range) - 1))
}

export function inRange(date: string, range: RangeKey): boolean {
  return date >= rangeStartDate(range) && date <= todayISO()
}

/** Epley formula: estimated 1-rep max from a weight × reps set. */
export function epley1RM(weight: number, reps: number): number {
  return weight * (1 + reps / 30)
}

function parseISOLocal(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

export function weekdayShortLabel(iso: string): string {
  return parseISOLocal(iso).toLocaleDateString('en-US', { weekday: 'short' })
}

export function monthDayLabel(iso: string): string {
  return parseISOLocal(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export type WeightPoint = { date: string; label: string; weight: number | null }

export function weightSeries(entries: BodyEntry[], range: RangeKey, units: Units): WeightPoint[] {
  const byDate = new Map(entries.map((e) => [e.date, e]))
  return lastNDays(rangeDays(range)).map((iso) => {
    const entry = byDate.get(iso)
    return {
      date: iso,
      label: monthDayLabel(iso),
      weight: entry ? convertWeight(entry.weightKg, units) : null,
    }
  })
}

/** Body entries within the range, sorted oldest to newest. */
export function entriesInRange(entries: BodyEntry[], range: RangeKey): BodyEntry[] {
  return entries.filter((e) => inRange(e.date, range)).sort((a, b) => (a.date < b.date ? -1 : 1))
}

export function lastNEntries(entries: BodyEntry[], n: number): BodyEntry[] {
  return [...entries].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, n)
}

/** A bar in the volume chart. `start`/`end` are inclusive ISO dates, so tapping a
 * bar can list exactly the sessions that built it. */
export type VolumePoint = { label: string; volume: number; start: string; end: string }

export function finishedSessionsInRange(sessions: WorkoutSession[], range: RangeKey): WorkoutSession[] {
  return sessions.filter((s) => s.finishedAt !== undefined && inRange(s.date, range))
}

export function volumeSeries(range: RangeKey, sessions: WorkoutSession[]): VolumePoint[] {
  const finished = sessions.filter((s) => s.finishedAt !== undefined)

  if (range === '7d') {
    return lastNDays(7).map((iso) => ({
      label: weekdayShortLabel(iso),
      start: iso,
      end: iso,
      volume: finished
        .filter((s) => s.date === iso)
        .reduce((sum, s) => sum + totalVolume(s), 0),
    }))
  }

  const bucketCount = Math.ceil(rangeDays(range) / 7)
  const points: VolumePoint[] = []
  for (let i = bucketCount - 1; i >= 0; i--) {
    const end = addDays(todayISO(), -i * 7)
    const start = addDays(end, -6)
    const volume = finished
      .filter((s) => s.date >= start && s.date <= end)
      .reduce((sum, s) => sum + totalVolume(s), 0)
    points.push({ label: monthDayLabel(start), start, end, volume })
  }
  return points
}

export function totalSetsInRange(sessions: WorkoutSession[]): number {
  return sessions.reduce((sum, s) => sum + totalSetsDone(s), 0)
}

export type StrengthPoint = { date: string; est1RM: number; weight: number; reps: number }

export type ExerciseTrend = {
  exerciseId: string
  /** Best working set per session, oldest → newest, within the range. */
  points: StrengthPoint[]
  /** Est-1RM at the start and end of the range, and the best inside it. */
  first: number
  last: number
  best: number
  /** Last day this exercise was trained — what the list is ordered by. */
  lastDate: string
}

/**
 * Per-exercise strength over time: one point per session, taken from the best
 * working set in it.
 *
 * Volume answers "how much work did I do"; this answers "am I getting stronger",
 * which is the question a lifter is actually asking. The best set is the right
 * summary of a session because it is the ceiling you reached — an extra back-off
 * set should not read as a worse day.
 */
export function exerciseTrends(sessions: WorkoutSession[], range: RangeKey): ExerciseTrend[] {
  const start = rangeStartDate(range)
  const byExercise = new Map<string, StrengthPoint[]>()

  const ordered = [...sessions].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  for (const session of ordered) {
    if (!session.finishedAt || session.date < start || session.date > todayISO()) continue
    for (const entry of session.entries) {
      let best: StrengthPoint | null = null
      for (const set of entry.sets) {
        if (!set.done || set.type === 'warmup' || set.reps <= 0 || set.weight <= 0) continue
        const est1RM = epley1RM(set.weight, set.reps)
        if (!best || est1RM > best.est1RM) {
          best = { date: session.date, est1RM, weight: set.weight, reps: set.reps }
        }
      }
      if (!best) continue
      const list = byExercise.get(entry.exerciseId) ?? []
      list.push(best)
      byExercise.set(entry.exerciseId, list)
    }
  }

  const out: ExerciseTrend[] = []
  for (const [exerciseId, points] of byExercise) {
    out.push({
      exerciseId,
      points,
      first: points[0].est1RM,
      last: points[points.length - 1].est1RM,
      best: points.reduce((m, p) => Math.max(m, p.est1RM), 0),
      lastDate: points[points.length - 1].date,
    })
  }
  // Most recently trained first: what you did yesterday is what you want to see.
  return out.sort((a, b) => (a.lastDate !== b.lastDate ? (a.lastDate < b.lastDate ? 1 : -1) : b.last - a.last))
}

export type PersonalRecord = {
  exerciseId: string
  est1RM: number
  weight: number
  reps: number
  /** The day the record was set — the first day it was reached, not the last. */
  date: string
}

/**
 * The standing record for every exercise — best estimated 1RM ever — NEWEST FIRST.
 *
 * The order is the whole point. This used to rank by est-1RM and keep the top
 * five, which made the card a list of your five heaviest lifts and nothing more:
 * a record set on anything lighter than a deadlift could never appear, and the
 * same five rows sat there unchanged for months. That is why it reads as broken
 * after a workout — not because the new record was missed, but because the card
 * had no way to show it. Ordering by when the record was set puts yesterday's PR
 * at the top, which is the only reason to open this card at all.
 */
export function personalRecords(sessions: WorkoutSession[]): PersonalRecord[] {
  const best = new Map<string, PersonalRecord>()
  // Oldest first, so a record equalled later keeps the date it was first set.
  const ordered = [...sessions].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  for (const session of ordered) {
    if (!session.finishedAt) continue
    for (const entry of session.entries) {
      for (const set of entry.sets) {
        if (!set.done || set.type === 'warmup' || set.reps <= 0 || set.weight <= 0) continue
        const est1RM = epley1RM(set.weight, set.reps)
        const current = best.get(entry.exerciseId)
        if (!current || est1RM > current.est1RM) {
          best.set(entry.exerciseId, {
            exerciseId: entry.exerciseId,
            est1RM,
            weight: set.weight,
            reps: set.reps,
            date: session.date,
          })
        }
      }
    }
  }
  return Array.from(best.values()).sort((a, b) =>
    a.date !== b.date ? (a.date < b.date ? 1 : -1) : b.est1RM - a.est1RM,
  )
}

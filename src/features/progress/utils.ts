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

export type VolumePoint = { label: string; volume: number }

export function finishedSessionsInRange(sessions: WorkoutSession[], range: RangeKey): WorkoutSession[] {
  return sessions.filter((s) => s.finishedAt !== undefined && inRange(s.date, range))
}

export function volumeSeries(range: RangeKey, sessions: WorkoutSession[]): VolumePoint[] {
  const finished = sessions.filter((s) => s.finishedAt !== undefined)

  if (range === '7d') {
    return lastNDays(7).map((iso) => ({
      label: weekdayShortLabel(iso),
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
    points.push({ label: monthDayLabel(start), volume })
  }
  return points
}

export function totalSetsInRange(sessions: WorkoutSession[]): number {
  return sessions.reduce((sum, s) => sum + totalSetsDone(s), 0)
}

export type PersonalRecord = {
  exerciseId: string
  est1RM: number
  weight: number
  reps: number
}

/** Best estimated 1RM per exercise across all finished sessions, ever. */
export function personalRecords(sessions: WorkoutSession[]): PersonalRecord[] {
  const best = new Map<string, PersonalRecord>()
  for (const session of sessions) {
    if (!session.finishedAt) continue
    for (const entry of session.entries) {
      for (const set of entry.sets) {
        if (!set.done || set.type === 'warmup' || set.reps <= 0 || set.weight <= 0) continue
        const est1RM = epley1RM(set.weight, set.reps)
        const current = best.get(entry.exerciseId)
        if (!current || est1RM > current.est1RM) {
          best.set(entry.exerciseId, { exerciseId: entry.exerciseId, est1RM, weight: set.weight, reps: set.reps })
        }
      }
    }
  }
  return Array.from(best.values())
    .sort((a, b) => b.est1RM - a.est1RM)
    .slice(0, 5)
}

import type { Units, WorkoutSession } from '../../types'
import { monthDayLabel } from '../progress/utils'

const KM_PER_MILE = 1.60934

/** A cardio activity is a finished session with a duration and no logged strength sets. */
export function isCardioSession(s: WorkoutSession): boolean {
  return s.finishedAt !== undefined && (s.durationMin ?? 0) > 0 && s.entries.every((e) => e.sets.length === 0)
}

export type CardioActivity = { name: string; count: number; hasDistance: boolean }

/** Distinct cardio activity names, most frequent first. */
export function cardioActivities(sessions: WorkoutSession[]): CardioActivity[] {
  const map = new Map<string, { count: number; hasDistance: boolean }>()
  for (const s of sessions) {
    if (!isCardioSession(s)) continue
    const cur = map.get(s.name) ?? { count: 0, hasDistance: false }
    cur.count += 1
    if ((s.distanceKm ?? 0) > 0) cur.hasDistance = true
    map.set(s.name, cur)
  }
  return Array.from(map.entries())
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.count - a.count)
}

export type CardioPoint = {
  date: string
  label: string
  durationMin: number
  distance: number | null
  kcal: number | null
  trainingLoad: number | null
  /** Pace in minutes per display distance unit (min/mi or min/km). */
  pace: number | null
}

/** Time series (oldest→newest) for one cardio activity name, in the user's units. */
export function cardioSeries(sessions: WorkoutSession[], name: string, units: Units): CardioPoint[] {
  const imperial = units === 'imperial'
  return sessions
    .filter((s) => isCardioSession(s) && s.name === name)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((s) => {
      const durationMin = s.durationMin ?? 0
      const distanceKm = s.distanceKm ?? null
      const distance = distanceKm === null ? null : imperial ? distanceKm / KM_PER_MILE : distanceKm
      const pace = distance && distance > 0 ? durationMin / distance : null
      return {
        date: s.date,
        label: monthDayLabel(s.date),
        durationMin,
        distance,
        kcal: typeof s.kcal === 'number' ? s.kcal : null,
        trainingLoad: typeof s.trainingLoad === 'number' ? s.trainingLoad : null,
        pace,
      }
    })
}

export function distanceUnitLabel(units: Units): string {
  return units === 'imperial' ? 'mi' : 'km'
}

/** Formats a pace (decimal minutes per unit) as "m:ss". */
export function formatPace(pace: number): string {
  const m = Math.floor(pace)
  const s = Math.round((pace - m) * 60)
  const ss = s === 60 ? '00' : String(s).padStart(2, '0')
  return `${s === 60 ? m + 1 : m}:${ss}`
}

export type CardioMetricKey = 'distance' | 'pace' | 'durationMin' | 'kcal'

export type CardioSummary = {
  sessions: number
  totalDistance: number
  bestPace: number | null
  avgPace: number | null
  totalDuration: number
}

export function cardioSummary(points: CardioPoint[]): CardioSummary {
  let totalDistance = 0
  let totalDuration = 0
  let bestPace: number | null = null
  const paces: number[] = []
  for (const p of points) {
    totalDuration += p.durationMin
    if (p.distance) totalDistance += p.distance
    if (p.pace) {
      paces.push(p.pace)
      if (bestPace === null || p.pace < bestPace) bestPace = p.pace
    }
  }
  const avgPace = paces.length ? paces.reduce((a, b) => a + b, 0) / paces.length : null
  return { sessions: points.length, totalDistance, bestPace, avgPace, totalDuration }
}

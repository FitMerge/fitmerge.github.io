import type { GarminRecord, Units, WorkoutSession } from '../../types'
import { monthDayLabel } from '../progress/utils'
import { addDays, todayISO } from '../../lib/date'

const KM_PER_MILE = 1.60934

/**
 * Which slice of history a cardio chart covers. `all` is deliberately the widest
 * rather than the default: a year of walks makes the recent weeks unreadable.
 */
export type CardioRange =
  | { kind: 'days'; days: number }
  | { kind: 'all' }
  | { kind: 'custom'; from: string; to: string }

export const CARDIO_RANGE_PRESETS: { label: string; range: CardioRange }[] = [
  { label: '30d', range: { kind: 'days', days: 30 } },
  { label: '90d', range: { kind: 'days', days: 90 } },
  { label: '1y', range: { kind: 'days', days: 365 } },
  { label: 'All', range: { kind: 'all' } },
]

/** `today` is injectable so this stays testable without freezing the clock. */
export function inCardioRange(date: string, range: CardioRange, today: string = todayISO()): boolean {
  if (range.kind === 'all') return true
  if (range.kind === 'custom') {
    // Tolerate the two ends being entered in either order.
    const [from, to] = range.from <= range.to ? [range.from, range.to] : [range.to, range.from]
    return date >= from && date <= to
  }
  return date >= addDays(today, -(range.days - 1)) && date <= today
}

/** A cardio activity is a finished session with a duration and no logged strength sets. */
export function isCardioSession(s: WorkoutSession): boolean {
  return s.finishedAt !== undefined && (s.durationMin ?? 0) > 0 && s.entries.every((e) => e.sets.length === 0)
}

export type ActivityCategory = 'Run' | 'Walk' | 'Hike' | 'Bike' | 'Ski' | 'Strength' | 'Other'

/**
 * Garmin names an activity after where and how you did it — "Denver Running",
 * "Arvada Running", "Treadmill Running" — so grouping on the raw name produced a
 * tab per city rather than per sport. Collapse to the sport itself.
 *
 * Order matters: the first pattern to match wins, so anything that could read as
 * two sports (snowshoeing is a hike, not a ski) is resolved by position here.
 */
const CATEGORY_PATTERNS: [RegExp, ActivityCategory][] = [
  [/\b(snowshoe|hik|trek)/i, 'Hike'],
  [/\b(ski|snowboard)/i, 'Ski'],
  [/\b(run|jog|sprint)/i, 'Run'],
  [/\b(walk|steps|stroll)/i, 'Walk'],
  [/\b(bike|biking|cycl|ride|spinning|peloton)/i, 'Bike'],
  [/\b(strength|weight|lifting|resistance|gym)/i, 'Strength'],
]

/** The major sport a session name belongs to, ignoring place and equipment. */
export function activityCategory(name: string): ActivityCategory {
  for (const [pattern, category] of CATEGORY_PATTERNS) {
    if (pattern.test(name)) return category
  }
  return 'Other'
}

/** Tie-break order when two categories have the same session count. */
const CATEGORY_ORDER: ActivityCategory[] = ['Run', 'Walk', 'Hike', 'Bike', 'Ski', 'Strength', 'Other']

export type CardioActivity = { category: ActivityCategory; count: number; hasDistance: boolean }

/** Major activity categories present in the log, most frequent first. */
export function cardioActivities(
  sessions: WorkoutSession[],
  range: CardioRange = { kind: 'all' },
  today: string = todayISO(),
): CardioActivity[] {
  const map = new Map<ActivityCategory, { count: number; hasDistance: boolean }>()
  for (const s of sessions) {
    if (!isCardioSession(s)) continue
    if (!inCardioRange(s.date, range, today)) continue
    const category = activityCategory(s.name)
    const cur = map.get(category) ?? { count: 0, hasDistance: false }
    cur.count += 1
    if ((s.distanceKm ?? 0) > 0) cur.hasDistance = true
    map.set(category, cur)
  }
  return Array.from(map.entries())
    .map(([category, v]) => ({ category, ...v }))
    .sort(
      (a, b) =>
        b.count - a.count || CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category),
    )
}

/** Epoch ms at local noon on an ISO date — noon so a timezone shift cannot move the day. */
export function isoToEpochMs(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1, 12).getTime()
}

export type CardioPoint = {
  date: string
  /**
   * Epoch ms, so the chart's x-axis can be a real time scale. Plotting against the
   * label instead spaces every session equally, which makes a three-month layoff
   * look the same as back-to-back days and lands ticks on arbitrary dates.
   */
  t: number
  label: string
  durationMin: number
  distance: number | null
  kcal: number | null
  trainingLoad: number | null
  /** Pace in minutes per display distance unit (min/mi or min/km). */
  pace: number | null
}

/** Time series (oldest→newest) for one activity category, in the user's units. */
export function cardioSeries(
  sessions: WorkoutSession[],
  category: ActivityCategory,
  units: Units,
  range: CardioRange = { kind: 'all' },
  today: string = todayISO(),
): CardioPoint[] {
  const imperial = units === 'imperial'
  return sessions
    .filter(
      (s) =>
        isCardioSession(s) &&
        activityCategory(s.name) === category &&
        inCardioRange(s.date, range, today),
    )
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((s) => {
      const durationMin = s.durationMin ?? 0
      const distanceKm = s.distanceKm ?? null
      const distance = distanceKm === null ? null : imperial ? distanceKm / KM_PER_MILE : distanceKm
      const pace = distance && distance > 0 ? durationMin / distance : null
      return {
        date: s.date,
        t: isoToEpochMs(s.date),
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

/** Standard race distances, in kilometres regardless of display units. */
export const DISTANCE_BANDS: { label: string; km: number }[] = [
  { label: '5K', km: 5 },
  { label: '10K', km: 10 },
  { label: 'Half', km: 21.0975 },
  { label: 'Marathon', km: 42.195 },
]

export type BestEffort = {
  label: string
  date: string
  durationMin: number
  distanceKm: number
  /** Pace in minutes per display unit. */
  pace: number
}

/**
 * Fastest session at each standard race distance.
 *
 * A deliberate limitation: the import carries one distance and one duration per
 * activity, not GPS splits, so this cannot find the quickest 5k *inside* a longer
 * run the way Strava does. It matches whole sessions that were about that far —
 * within `tolerance` — which is honest about what the data supports.
 *
 * Ranked on pace rather than elapsed time so a 5.2km run does not beat a 5.0km run
 * purely by being measured over more ground.
 */
export function bestEfforts(
  sessions: WorkoutSession[],
  category: ActivityCategory = 'Run',
  units: Units = 'metric',
  range: CardioRange = { kind: 'all' },
  today: string = todayISO(),
  tolerance = 0.05,
): BestEffort[] {
  const imperial = units === 'imperial'
  const candidates = sessions.filter(
    (s) =>
      isCardioSession(s) &&
      activityCategory(s.name) === category &&
      inCardioRange(s.date, range, today) &&
      (s.distanceKm ?? 0) > 0 &&
      (s.durationMin ?? 0) > 0,
  )

  const out: BestEffort[] = []
  for (const band of DISTANCE_BANDS) {
    let best: BestEffort | null = null
    for (const s of candidates) {
      const km = s.distanceKm as number
      if (Math.abs(km - band.km) > band.km * tolerance) continue
      const durationMin = s.durationMin as number
      const distance = imperial ? km / KM_PER_MILE : km
      const pace = durationMin / distance
      if (best === null || pace < best.pace) {
        best = { label: band.label, date: s.date, durationMin, distanceKm: km, pace }
      }
    }
    if (best) out.push(best)
  }
  return out
}

/**
 * Garmin's own records, formatted for display. Preferred over locally-computed
 * best efforts because Garmin measures across segments within an activity, so its
 * 5K can come from a stretch inside a longer run.
 */
export function formatGarminRecord(record: GarminRecord, units: Units): string {
  if (record.kind === 'time') return formatDuration(record.value / 60)
  const km = record.value / 1000
  const distance = units === 'imperial' ? km / KM_PER_MILE : km
  return `${distance.toFixed(1)} ${distanceUnitLabel(units)}`
}

/** Formats decimal minutes as "m:ss", or "h:mm:ss" once it runs past an hour. */
export function formatDuration(minutes: number): string {
  const totalSeconds = Math.round(minutes * 60)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Formats a pace (decimal minutes per unit) as "m:ss". */
export function formatPace(pace: number): string {
  const m = Math.floor(pace)
  const s = Math.round((pace - m) * 60)
  const ss = s === 60 ? '00' : String(s).padStart(2, '0')
  return `${s === 60 ? m + 1 : m}:${ss}`
}

export type CardioMetricKey = 'distance' | 'pace' | 'durationMin' | 'kcal'

/**
 * True when a few outsized sessions would squash the rest of the chart flat — one
 * half marathon among a season of 5k runs, say.
 *
 * Compares the largest value against the median rather than the mean, so the spike
 * being measured cannot inflate the baseline it is measured against. Needs a few
 * sessions before it will claim anything: with two or three points there is no
 * "typical" value to be an outlier from.
 */
export function hasOutlierSpike(values: (number | null)[]): boolean {
  const sorted = values
    .filter((v): v is number => v !== null && Number.isFinite(v) && v > 0)
    .sort((a, b) => a - b)
  if (sorted.length < 4) return false
  const median = sorted[Math.floor(sorted.length / 2)]
  if (median <= 0) return false
  return sorted[sorted.length - 1] > median * 2.5
}

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

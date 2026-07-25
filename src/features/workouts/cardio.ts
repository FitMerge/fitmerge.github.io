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

/**
 * Garmin's sport keys, which the import now carries. These are authoritative
 * where the display name was always a guess: `indoor_cardio` reads as nothing in
 * particular by name, but its key says exactly what it is. Matched as substrings
 * so the long tail (`obstacle_run`, `virtual_ride`, `backcountry_snowboarding`)
 * lands in the right bucket without enumerating every one.
 *
 * Ordered like the name patterns: first match wins, so `snowshoeing` is a hike
 * before `mountain_biking` can claim anything containing "bik".
 */
const SPORT_KEY_PATTERNS: [RegExp, ActivityCategory][] = [
  [/snowshoe|hiking|mountaineer/, 'Hike'],
  [/ski|snowboard/, 'Ski'],
  [/run/, 'Run'],
  [/walk/, 'Walk'],
  [/cycling|biking|_ride$|^ride|handcycling/, 'Bike'],
  [/strength|weight|hiit|pilates|yoga|bouldering|climb/, 'Strength'],
]

/**
 * The major sport a session belongs to, ignoring place and equipment.
 *
 * `sportType` (Garmin's key) is consulted first and, when it matches, decides
 * outright. Only sessions without one — logged in the app, or imported before
 * the field was captured — fall back to reading the name.
 */
export function activityCategory(name: string, sportType?: string): ActivityCategory {
  if (sportType) {
    const key = sportType.toLowerCase()
    for (const [pattern, category] of SPORT_KEY_PATTERNS) {
      if (pattern.test(key)) return category
    }
  }
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
    const category = activityCategory(s.name, s.sportType)
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
  /** The session this came from, so a list row can open its detail. */
  id: string
  name: string
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
  /** Detail carried straight through from the import; null where unmeasured. */
  elevationGainM: number | null
  avgHr: number | null
  maxHr: number | null
  avgCadence: number | null
  aerobicTe: number | null
  anaerobicTe: number | null
  startTime: string | null
}

/** Reads an optional numeric session field as a value-or-null. */
function num(v: number | undefined): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
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
        activityCategory(s.name, s.sportType) === category &&
        inCardioRange(s.date, range, today),
    )
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((s) => {
      const durationMin = s.durationMin ?? 0
      const distanceKm = s.distanceKm ?? null
      const distance = distanceKm === null ? null : imperial ? distanceKm / KM_PER_MILE : distanceKm
      const pace = distance && distance > 0 ? durationMin / distance : null
      return {
        id: s.id,
        name: s.name,
        date: s.date,
        t: isoToEpochMs(s.date),
        label: monthDayLabel(s.date),
        durationMin,
        distance,
        kcal: num(s.kcal),
        trainingLoad: num(s.trainingLoad),
        pace,
        elevationGainM: num(s.elevationGainM),
        avgHr: num(s.avgHr),
        maxHr: num(s.maxHr),
        avgCadence: num(s.avgCadence),
        aerobicTe: num(s.aerobicTe),
        anaerobicTe: num(s.anaerobicTe),
        startTime: s.startTime ?? null,
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
      activityCategory(s.name, s.sportType) === category &&
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

/**
 * Formats a span of hours or days as "45h 49m".
 *
 * {@link formatDuration} is right for a single activity, where seconds matter and
 * "43:30" is how a runner reads a 10K. It is wrong for a period total: 45 hours of
 * training renders as "45:49:24", which parses as a time of day before it parses
 * as three-quarters of a working week.
 */
export function formatTotalDuration(minutes: number): string {
  const total = Math.round(minutes)
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h === 0) return `${m}m`
  return `${h.toLocaleString()}h ${m}m`
}

const FEET_PER_METRE = 3.28084

export function elevationUnitLabel(units: Units): string {
  return units === 'imperial' ? 'ft' : 'm'
}

/** Ascent is stored in metres whatever the display units; convert at the edge. */
export function toDisplayElevation(metres: number, units: Units): number {
  return units === 'imperial' ? metres * FEET_PER_METRE : metres
}

/** Formats a pace (decimal minutes per unit) as "m:ss". */
export function formatPace(pace: number): string {
  const m = Math.floor(pace)
  const s = Math.round((pace - m) * 60)
  const ss = s === 60 ? '00' : String(s).padStart(2, '0')
  return `${s === 60 ? m + 1 : m}:${ss}`
}

export type CardioMetricKey = 'distance' | 'pace' | 'durationMin' | 'kcal'

// --- period aggregation ------------------------------------------------------
//
// Plotting one point per session across a year is unreadable: the dots scatter,
// the trend line whips about, and a single long run rescales the whole axis.
// Strava, Garmin Connect and Nike all solve this the same way — aggregate into
// weekly or monthly totals and draw bars. Uniform periods also make an evenly
// spaced axis honest, which a per-session axis never was.

export type BucketSize = 'week' | 'month'

export type CardioBucket = {
  key: string
  label: string
  sessions: number
  /** Period totals, in display units. */
  distance: number | null
  durationMin: number
  kcal: number | null
  /** Average pace over the period — total time over total distance, not a mean of
   * per-session paces, so a long steady run counts for more than a short sprint. */
  pace: number | null
}

/** Weekly up to a quarter, monthly beyond — about 12-16 bars either way. */
export function bucketSizeFor(range: CardioRange): BucketSize {
  if (range.kind === 'all') return 'month'
  if (range.kind === 'custom') {
    const days = Math.abs(isoToEpochMs(range.to) - isoToEpochMs(range.from)) / 86_400_000
    return days > 100 ? 'month' : 'week'
  }
  return range.days > 100 ? 'month' : 'week'
}

/** ISO date of the period `iso` falls in — Monday for weeks, the 1st for months. */
export function periodKey(iso: string, size: BucketSize): string {
  return startOfPeriod(iso, size)
}

/** Display label for a period start, e.g. "Jun" or "Jun 8". */
export function periodLabelFor(iso: string, size: BucketSize): string {
  return periodLabel(iso, size)
}

function startOfPeriod(iso: string, size: BucketSize): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (size === 'month') return `${y}-${String(m).padStart(2, '0')}-01`
  const date = new Date(y, m - 1, d)
  // Monday-based weeks, matching how training weeks are usually counted.
  const shift = (date.getDay() + 6) % 7
  date.setDate(date.getDate() - shift)
  const yy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

function nextPeriod(iso: string, size: BucketSize): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  if (size === 'month') date.setMonth(date.getMonth() + 1)
  else date.setDate(date.getDate() + 7)
  const yy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

function periodLabel(iso: string, size: BucketSize): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return size === 'month'
    ? date.toLocaleDateString('en-US', { month: 'short' })
    : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/**
 * Group a session series into consecutive periods. Periods with no activity are
 * emitted as zeros rather than skipped — a fortnight off is information, and
 * dropping it would silently compress the timeline.
 */
export function bucketCardio(points: CardioPoint[], size: BucketSize): CardioBucket[] {
  if (points.length === 0) return []

  const totals = new Map<string, { sessions: number; distance: number; durationMin: number; kcal: number; hasDistance: boolean; hasKcal: boolean }>()
  for (const p of points) {
    const key = startOfPeriod(p.date, size)
    const cur =
      totals.get(key) ??
      { sessions: 0, distance: 0, durationMin: 0, kcal: 0, hasDistance: false, hasKcal: false }
    cur.sessions += 1
    cur.durationMin += p.durationMin
    if (p.distance !== null) {
      cur.distance += p.distance
      cur.hasDistance = true
    }
    if (p.kcal !== null) {
      cur.kcal += p.kcal
      cur.hasKcal = true
    }
    totals.set(key, cur)
  }

  const keys = [...totals.keys()].sort()
  const out: CardioBucket[] = []
  for (let key = keys[0]; key <= keys[keys.length - 1]; key = nextPeriod(key, size)) {
    const t = totals.get(key)
    out.push({
      key,
      label: periodLabel(key, size),
      sessions: t?.sessions ?? 0,
      distance: t?.hasDistance ? t.distance : null,
      durationMin: t?.durationMin ?? 0,
      kcal: t?.hasKcal ? t.kcal : null,
      pace: t && t.hasDistance && t.distance > 0 ? t.durationMin / t.distance : null,
    })
  }
  return out
}


export type CardioSummary = {
  sessions: number
  totalDistance: number
  bestPace: number | null
  avgPace: number | null
  totalDuration: number
  /** Total ascent in metres across sessions that recorded it; null if none did. */
  totalElevationM: number | null
  /** Heart rate averaged over sessions that recorded one; null if none did. */
  avgHr: number | null
  totalKcal: number | null
}

export function cardioSummary(points: CardioPoint[]): CardioSummary {
  let totalDistance = 0
  let totalDuration = 0
  let bestPace: number | null = null
  let elevation = 0
  let elevationCount = 0
  let hrSum = 0
  let hrCount = 0
  let kcal = 0
  let kcalCount = 0
  const paces: number[] = []
  for (const p of points) {
    totalDuration += p.durationMin
    if (p.distance) totalDistance += p.distance
    if (p.pace) {
      paces.push(p.pace)
      if (bestPace === null || p.pace < bestPace) bestPace = p.pace
    }
    if (p.elevationGainM !== null) {
      elevation += p.elevationGainM
      elevationCount += 1
    }
    if (p.avgHr !== null) {
      hrSum += p.avgHr
      hrCount += 1
    }
    if (p.kcal !== null) {
      kcal += p.kcal
      kcalCount += 1
    }
  }
  const avgPace = paces.length ? paces.reduce((a, b) => a + b, 0) / paces.length : null
  return {
    sessions: points.length,
    totalDistance,
    bestPace,
    avgPace,
    totalDuration,
    // Null rather than 0 when nothing was measured: a flat 0 m of climbing is a
    // claim about the terrain, and we have no basis for making it.
    totalElevationM: elevationCount > 0 ? elevation : null,
    avgHr: hrCount > 0 ? hrSum / hrCount : null,
    totalKcal: kcalCount > 0 ? kcal : null,
  }
}

// --- period-over-period comparison -------------------------------------------
//
// "You have run further this month than last" is the single most motivating line
// in Strava, and it costs nothing to compute: run the same summary over the
// window immediately before the one on screen and diff the totals.

/**
 * The window of equal length ending the day before `range` starts.
 *
 * Null for `all`, which has no "before" — the log begins where it begins, and
 * comparing all-time against an empty stretch would be meaningless.
 */
export function previousRange(range: CardioRange, today: string = todayISO()): CardioRange | null {
  if (range.kind === 'all') return null
  if (range.kind === 'days') {
    return { kind: 'custom', from: addDays(today, -(range.days * 2 - 1)), to: addDays(today, -range.days) }
  }
  const [from, to] = range.from <= range.to ? [range.from, range.to] : [range.to, range.from]
  const span = Math.round((isoToEpochMs(to) - isoToEpochMs(from)) / 86_400_000) + 1
  return { kind: 'custom', from: addDays(from, -span), to: addDays(from, -1) }
}

export type CardioDelta = {
  label: string
  value: number
  previous: number
  /** Signed fractional change, or null when the previous period was empty —
   * "up from nothing" has no percentage and showing ∞% would be nonsense. */
  changePct: number | null
}

/** Totals for the current period against the one before it. */
export function compareSummaries(
  current: CardioSummary,
  previous: CardioSummary,
  distUnit: string,
): CardioDelta[] {
  // Ascent stays in metres here: the deltas are percentages, and a percentage is
  // the same number in either unit.
  const rows: [string, number, number][] = [
    [`Distance (${distUnit})`, current.totalDistance, previous.totalDistance],
    ['Time (min)', current.totalDuration, previous.totalDuration],
    ['Sessions', current.sessions, previous.sessions],
  ]
  if (current.totalElevationM !== null || previous.totalElevationM !== null) {
    rows.push(['Ascent (m)', current.totalElevationM ?? 0, previous.totalElevationM ?? 0])
  }
  return (
    rows
      // A metric neither period recorded is not news. Skiing has no distance, and
      // reporting "Distance: new" against nothing is worse than saying nothing.
      .filter(([, value, prev]) => value > 0 || prev > 0)
      .map(([label, value, prev]) => ({
        label,
        value,
        previous: prev,
        changePct: prev > 0 ? (value - prev) / prev : null,
      }))
  )
}

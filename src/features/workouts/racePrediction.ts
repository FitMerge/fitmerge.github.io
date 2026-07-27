// Race-time prediction and running-fitness estimation.
//
// This is the analysis layer Strava, Garmin and MapMyRun all put in front of a
// runner: given what you have actually raced or trained, what should you be able
// to run, and at what paces should you be training? Two well-established models
// do the work, and neither needs anything the app does not already store — one
// distance and one duration per activity is enough.
//
//   Riegel (1977)   T2 = T1 * (D2 / D1) ^ 1.06
//     Predicts a time at one distance from a known time at another. The 1.06
//     exponent is the published fatigue factor; it is what Garmin's race
//     predictor and most online calculators use.
//
//   Daniels & Gilbert VDOT
//     An effort-adjusted VO2max derived from a race performance. It powers the
//     training-pace zones below, which is the part runners use daily.
//
// Both degrade badly when extrapolated far from the reference performance, so
// `predictRaces` reports a confidence per prediction rather than pretending a
// 5K time tells you much about a marathon.

import type { GarminRecord, Units, WorkoutSession } from '../../types'
import {
  isCardioSession,
  activityCategory,
  bucketSizeFor,
  periodKey,
  periodLabelFor,
  type BucketSize,
  type CardioRange,
  inCardioRange,
} from './cardio'
import { todayISO } from '../../lib/date'

const KM_PER_MILE = 1.60934

/** Riegel's fatigue exponent — the rate at which pace decays as distance grows. */
export const RIEGEL_EXPONENT = 1.06

export type RaceDistance = { label: string; km: number }

export const RACE_DISTANCES: RaceDistance[] = [
  { label: '1 mile', km: KM_PER_MILE },
  { label: '5K', km: 5 },
  { label: '10K', km: 10 },
  { label: 'Half', km: 21.0975 },
  { label: 'Marathon', km: 42.195 },
]

/** Riegel: time (minutes) to cover `toKm`, given `fromMin` over `fromKm`. */
export function riegel(fromKm: number, fromMin: number, toKm: number): number {
  if (fromKm <= 0 || fromMin <= 0 || toKm <= 0) return 0
  return fromMin * Math.pow(toKm / fromKm, RIEGEL_EXPONENT)
}

// --- VDOT ------------------------------------------------------------------

/** Oxygen cost (ml/kg/min) of running at `metresPerMin` — Daniels' velocity equation. */
export function vo2AtVelocity(metresPerMin: number): number {
  return -4.6 + 0.182258 * metresPerMin + 0.000104 * metresPerMin * metresPerMin
}

/**
 * Fraction of VO2max sustainable for `minutes` of hard running. Falls from ~1.0
 * at a few minutes towards ~0.8 over several hours, which is why a 5K and a
 * marathon at the same VDOT are run at very different paces.
 */
export function fractionOfMax(minutes: number): number {
  return 0.8 + 0.1894393 * Math.exp(-0.012778 * minutes) + 0.2989558 * Math.exp(-0.1932605 * minutes)
}

/** Inverse of {@link vo2AtVelocity}: the velocity (m/min) that costs `vo2`. */
export function velocityAtVo2(vo2: number): number {
  // Positive root of 0.000104 v² + 0.182258 v − (4.6 + vo2) = 0.
  const a = 0.000104
  const b = 0.182258
  const c = -(4.6 + vo2)
  const disc = b * b - 4 * a * c
  if (disc <= 0) return 0
  return (-b + Math.sqrt(disc)) / (2 * a)
}

/**
 * VDOT from a performance: an effort-adjusted VO2max in ml/kg/min. Roughly
 * equal to true VO2max for a well-trained runner, and directly comparable
 * between runners in a way that raw pace is not.
 */
export function vdot(distanceKm: number, durationMin: number): number | null {
  if (distanceKm <= 0 || durationMin <= 0) return null
  const velocity = (distanceKm * 1000) / durationMin
  const fraction = fractionOfMax(durationMin)
  if (fraction <= 0) return null
  return vo2AtVelocity(velocity) / fraction
}

// --- training paces ---------------------------------------------------------

/**
 * Daniels' five training intensities, as a fraction of VDOT. Ranges rather than
 * points because that is how they are prescribed — "easy" is a band you stay
 * inside, not a pace you hit.
 */
const PACE_ZONES: { key: string; label: string; description: string; from: number; to: number }[] = [
  { key: 'easy', label: 'Easy', description: 'Most of your weekly mileage', from: 0.59, to: 0.74 },
  { key: 'marathon', label: 'Marathon', description: 'Race pace for the long stuff', from: 0.75, to: 0.84 },
  { key: 'threshold', label: 'Threshold', description: 'Comfortably hard — tempo runs', from: 0.83, to: 0.88 },
  { key: 'interval', label: 'Interval', description: '3–5 min reps at VO2max', from: 0.95, to: 1.0 },
  { key: 'repetition', label: 'Repetition', description: 'Short, fast, full recovery', from: 1.05, to: 1.2 },
]

export type TrainingPace = {
  key: string
  label: string
  description: string
  /** Pace bounds in minutes per display unit, fastest first. */
  fastMin: number
  slowMin: number
}

/** Training-pace bands for a VDOT, in the user's display units. */
export function trainingPaces(vdotValue: number, units: Units): TrainingPace[] {
  const unitKm = units === 'imperial' ? KM_PER_MILE : 1
  return PACE_ZONES.map((zone) => ({
    key: zone.key,
    label: zone.label,
    description: zone.description,
    // A higher fraction of VDOT is a faster pace, so `to` gives the fast bound.
    fastMin: paceFor(vdotValue * zone.to),
    slowMin: paceFor(vdotValue * zone.from),
  }))

  /** Minutes per display unit at an oxygen cost of `vo2`. */
  function paceFor(vo2: number): number {
    const velocity = velocityAtVo2(vo2)
    return velocity > 0 ? (1000 * unitKm) / velocity : 0
  }
}

// --- predictions ------------------------------------------------------------

/**
 * How far a prediction is being stretched from the performance it rests on.
 * Riegel holds well within about a factor of two either way and drifts
 * optimistic beyond that — a marathon predicted off a 5K assumes an endurance
 * base the 5K says nothing about.
 */
export type Confidence = 'high' | 'moderate' | 'low'

export function confidenceFor(fromKm: number, toKm: number): Confidence {
  const ratio = toKm > fromKm ? toKm / fromKm : fromKm / toKm
  if (ratio <= 2) return 'high'
  if (ratio <= 4) return 'moderate'
  return 'low'
}

export type RacePrediction = {
  label: string
  km: number
  /** Predicted finishing time, in minutes. */
  durationMin: number
  /** Pace in minutes per display unit. */
  pace: number
  confidence: Confidence
  /** True when the source effort was itself at about this distance. */
  isSource: boolean
  /** The effort this row was predicted from. Each distance gets its own, so a
   * 10K is predicted from your 10K efforts rather than from a mile PR. */
  source: { km: number; date: string; name: string; fromRecord: boolean }
}

export type FitnessEstimate = {
  vdot: number
  /** The performance the estimate rests on. */
  source: {
    label: string
    km: number
    durationMin: number
    date: string
    /** True when this came from a Garmin personal record rather than a whole
     * session — worth surfacing, since a PR can be a segment inside a longer run. */
    fromRecord: boolean
  }
  predictions: RacePrediction[]
  paces: TrainingPace[]
}

/**
 * The single best run to predict from.
 *
 * "Best" is highest VDOT, not fastest pace: VDOT already accounts for distance,
 * so a strong half marathon can and should outrank a quick parkrun. Sessions
 * shorter than 1.5km are ignored — the models are unreliable at sprint
 * distances, and a 400m stride is not a performance.
 */
export function bestPerformance(
  sessions: WorkoutSession[],
  range: CardioRange = { kind: 'all' },
  today: string = todayISO(),
): Performance | null {
  const all = allPerformances(sessions, range, today)
  return all.length === 0 ? null : all.reduce((a, b) => (b.vdot > a.vdot ? b : a))
}

export type Performance = {
  km: number
  durationMin: number
  date: string
  name: string
  vdot: number
  /** True for a Garmin personal record rather than a whole session. */
  fromRecord: boolean
}

/**
 * Every run good enough to predict from, in the window.
 *
 * All of them, not just the best: a prediction at 10K should be able to draw on
 * your actual 10-kilometre efforts rather than being extrapolated from whichever
 * single run happens to have the highest VDOT. Runs under 1.5km are excluded —
 * the models are unreliable at sprint distances, and a 400m stride is not a
 * performance.
 */
export function allPerformances(
  sessions: WorkoutSession[],
  range: CardioRange = { kind: 'all' },
  today: string = todayISO(),
): Performance[] {
  const out: Performance[] = []
  for (const s of sessions) {
    if (!isCardioSession(s)) continue
    if (activityCategory(s.name, s.sportType) !== 'Run') continue
    if (!inCardioRange(s.date, range, today)) continue
    const km = s.distanceKm ?? 0
    const durationMin = s.durationMin ?? 0
    if (km < 1.5 || durationMin <= 0) continue
    const v = vdot(km, durationMin)
    if (v === null) continue
    out.push({ km, durationMin, date: s.date, name: s.name, vdot: v, fromRecord: false })
  }
  return out
}

/**
 * Distance, in kilometres, behind each of Garmin's timed personal-record types.
 *
 * These make far better prediction sources than whole sessions. Garmin measures a
 * record across segments *within* an activity, so its "Fastest 5K" is the quickest
 * 5km you have ever covered — including the fast middle of a 10K, which the
 * session-level data (one distance, one duration) can never see.
 */
const RECORD_DISTANCE_KM: Record<number, number> = {
  1: 1,
  2: KM_PER_MILE,
  3: 5,
  4: 10,
  5: 21.0975,
  6: 42.195,
}

/** Garmin's timed records as candidate performances. */
function recordPerformances(records: GarminRecord[]): Performance[] {
  const out: Performance[] = []
  for (const record of records) {
    const km = RECORD_DISTANCE_KM[record.typeId]
    // Only the timed records map to a distance; "longest run" is a distance record
    // with no time attached and says nothing about speed.
    if (km === undefined || record.kind !== 'time' || record.value <= 0) continue
    // A 1km record is too short for the model to be meaningful, same as sessions.
    if (km < 1.5) continue
    const durationMin = record.value / 60
    const v = vdot(km, durationMin)
    if (v === null) continue
    out.push({ km, durationMin, date: record.date ?? '', name: record.label, vdot: v, fromRecord: true })
  }
  return out
}

// --- fitness trend -----------------------------------------------------------

export type VdotPoint = {
  key: string
  label: string
  /** Best VDOT achieved in this period; null for periods with no qualifying run. */
  vdot: number | null
  /** Predicted 5K time (minutes) at that VDOT — the readable face of the number. */
  predicted5k: number | null
}

/**
 * Best running fitness per period, oldest first — Garmin's race-predictor trend.
 *
 * The *best* run of each period rather than the average, because fitness is what
 * you are capable of, not what you happened to do on your easy days. Empty
 * periods are emitted as nulls and drawn as gaps: a month with no hard running
 * says nothing about fitness, and interpolating across it would invent a trend.
 */
export function vdotTrend(
  sessions: WorkoutSession[],
  range: CardioRange = { kind: 'all' },
  today: string = todayISO(),
): VdotPoint[] {
  const size: BucketSize = bucketSizeFor(range)
  const best = new Map<string, number>()
  for (const s of sessions) {
    if (!isCardioSession(s)) continue
    if (activityCategory(s.name, s.sportType) !== 'Run') continue
    if (!inCardioRange(s.date, range, today)) continue
    const km = s.distanceKm ?? 0
    const durationMin = s.durationMin ?? 0
    if (km < 1.5 || durationMin <= 0) continue
    const v = vdot(km, durationMin)
    if (v === null) continue
    const key = periodKey(s.date, size)
    const cur = best.get(key)
    if (cur === undefined || v > cur) best.set(key, v)
  }
  if (best.size === 0) return []

  const keys = [...best.keys()].sort()
  const out: VdotPoint[] = []
  for (let key = keys[0]; key <= keys[keys.length - 1]; key = nextPeriodKey(key, size)) {
    const v = best.get(key) ?? null
    out.push({
      key,
      label: periodLabelFor(key, size),
      vdot: v,
      predicted5k: v === null ? null : timeAtVdot(v, 5),
    })
  }
  return out
}

/** Start of the period after `iso`. */
function nextPeriodKey(iso: string, size: BucketSize): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  if (size === 'month') date.setMonth(date.getMonth() + 1)
  else date.setDate(date.getDate() + 7)
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${mm}-${dd}`
}

/**
 * Race time (minutes) over `distanceKm` for a given VDOT.
 *
 * Inverts the VDOT definition, which is circular — the sustainable fraction of
 * VO2max depends on the duration being solved for — so it is settled by fixed-point
 * iteration. It converges in a handful of passes because the fraction moves slowly
 * against the time.
 */
export function timeAtVdot(vdotValue: number, distanceKm: number): number {
  const metres = distanceKm * 1000
  let minutes = metres / velocityAtVo2(vdotValue * 0.9) || 1
  for (let i = 0; i < 30; i += 1) {
    const velocity = velocityAtVo2(vdotValue * fractionOfMax(minutes))
    if (velocity <= 0) return 0
    const next = metres / velocity
    if (Math.abs(next - minutes) < 1e-6) return next
    minutes = next
  }
  return minutes
}

/**
 * The best effort to predict `targetKm` from.
 *
 * Predicting everything from one global best is what made a stale 1-mile PR drive
 * a marathon estimate: it had the highest VDOT, so it won outright, and every
 * other distance became a long extrapolation with low confidence while hundreds of
 * actual runs went unused.
 *
 * Instead, prefer efforts near the target distance and only widen the search when
 * there is nothing close: strongest effort within 2x, else within 4x, else the
 * strongest there is. Riegel is reliable inside that first band, so a runner with
 * real 5K and 10K efforts now gets both predicted from the real thing.
 */
export function sourceFor(targetKm: number, candidates: Performance[]): Performance | null {
  if (candidates.length === 0) return null
  const ratio = (km: number): number => (km > targetKm ? km / targetKm : targetKm / km)
  for (const limit of [2, 4, Infinity]) {
    const near = candidates.filter((c) => ratio(c.km) <= limit)
    if (near.length > 0) return near.reduce((a, b) => (b.vdot > a.vdot ? b : a))
  }
  return null
}

/** Nearest standard race distance to `km`, for labelling a performance. */
function nearestDistance(km: number): RaceDistance {
  let nearest = RACE_DISTANCES[0]
  for (const d of RACE_DISTANCES) {
    if (Math.abs(Math.log(d.km / km)) < Math.abs(Math.log(nearest.km / km))) nearest = d
  }
  return nearest
}

/**
 * Predicted race times and training paces from the athlete's best recent run.
 *
 * Returns null when there is nothing to predict from, which is the honest answer
 * — a fabricated marathon time from no running data would be worse than silence.
 */
export function estimateFitness(
  sessions: WorkoutSession[],
  units: Units = 'metric',
  range: CardioRange = { kind: 'all' },
  today: string = todayISO(),
  /** Garmin's timed records. All-time by nature, so deliberately not filtered by
   * `range` — a PR is a PR. */
  records: GarminRecord[] = [],
): FitnessEstimate | null {
  const candidates = [...allPerformances(sessions, range, today), ...recordPerformances(records)]
  if (candidates.length === 0) return null

  // The headline number stays the strongest single effort — that is what "current
  // fitness" means, and it is what the training paces are prescribed from.
  const best = candidates.reduce((a, b) => (b.vdot > a.vdot ? b : a))
  const unitKm = units === 'imperial' ? KM_PER_MILE : 1

  const predictions: RacePrediction[] = RACE_DISTANCES.map((race) => {
    // Non-null: candidates is non-empty, and the last tier accepts everything.
    const source = sourceFor(race.km, candidates) as Performance
    const durationMin = riegel(source.km, source.durationMin, race.km)
    return {
      label: race.label,
      km: race.km,
      durationMin,
      pace: durationMin / (race.km / unitKm),
      confidence: confidenceFor(source.km, race.km),
      isSource: nearestDistance(source.km).label === race.label,
      source: {
        km: source.km,
        date: source.date,
        name: source.name,
        fromRecord: source.fromRecord,
      },
    }
  })

  return {
    vdot: best.vdot,
    source: {
      label: nearestDistance(best.km).label,
      km: best.km,
      durationMin: best.durationMin,
      date: best.date,
      fromRecord: best.fromRecord,
    },
    predictions,
    paces: trainingPaces(best.vdot, units),
  }
}

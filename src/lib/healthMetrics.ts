// Catalog of known health metrics (Garmin, Apple Health, …) → display label, unit,
// formatting, grouping, and ordering. Anything NOT in the catalog still renders with a
// derived label, so new/unknown metrics need no code change.

export type MetricGroup = 'training' | 'heart' | 'sleep' | 'activity' | 'body' | 'other'

export type MetricMeta = {
  key: string
  label: string
  unit?: string
  format?: (v: number) => string
  order: number
  group: MetricGroup
  /** When true, a downward trend is an improvement (resting HR, stress, race times…). */
  lowerIsBetter?: boolean
}

const round = (v: number) => String(Math.round(v))
const commas = (v: number) => Math.round(v).toLocaleString()
const one = (v: number) => v.toFixed(1)
const hoursMinutes = (v: number) => `${Math.floor(v / 60)}h ${Math.round(v % 60)}m`
/** Seconds → race-time string (m:ss under an hour, h:mm:ss over). */
const raceTime = (secs: number) => {
  const s = Math.round(secs)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${m}:${String(sec).padStart(2, '0')}`
}

type CatalogEntry = Omit<MetricMeta, 'key'>

const CATALOG: Record<string, CatalogEntry> = {
  // ── Activity ──────────────────────────────────────────────────────────────
  steps: { label: 'Steps', group: 'activity', order: 1, format: commas },
  distanceKm: { label: 'Distance', unit: 'km', group: 'activity', order: 2, format: (v) => v.toFixed(2) },
  floors: { label: 'Floors climbed', group: 'activity', order: 3, format: round },
  intensityMinutes: { label: 'Intensity minutes', unit: 'min', group: 'activity', order: 4, format: round },
  moderateIntensityMinutes: { label: 'Moderate intensity', unit: 'min', group: 'activity', order: 4.1, format: round },
  vigorousIntensityMinutes: { label: 'Vigorous intensity', unit: 'min', group: 'activity', order: 4.2, format: round },
  activeCalories: { label: 'Active calories', unit: 'kcal', group: 'activity', order: 5, format: commas },
  totalCalories: { label: 'Total calories', unit: 'kcal', group: 'activity', order: 6, format: commas },
  hydrationMl: { label: 'Hydration', unit: 'ml', group: 'activity', order: 7, format: commas },

  // ── Heart & recovery ──────────────────────────────────────────────────────
  restingHr: { label: 'Resting heart rate', unit: 'bpm', group: 'heart', order: 10, format: round, lowerIsBetter: true },
  maxHr: { label: 'Max heart rate', unit: 'bpm', group: 'heart', order: 11, format: round },
  hrv: { label: 'HRV', unit: 'ms', group: 'heart', order: 12, format: round },
  stress: { label: 'Stress (avg)', group: 'heart', order: 13, format: round, lowerIsBetter: true },
  maxStress: { label: 'Stress (max)', group: 'heart', order: 13.5, format: round, lowerIsBetter: true },
  bodyBattery: { label: 'Body Battery', group: 'heart', order: 14, format: round },
  bodyBatteryHigh: { label: 'Body Battery (high)', group: 'heart', order: 14.1, format: round },
  bodyBatteryLow: { label: 'Body Battery (low)', group: 'heart', order: 14.2, format: round },
  bodyBatteryCharged: { label: 'Body Battery charged', group: 'heart', order: 14.3, format: round },
  bodyBatteryDrained: { label: 'Body Battery drained', group: 'heart', order: 14.4, format: round, lowerIsBetter: true },
  spo2: { label: 'Pulse Ox (avg)', unit: '%', group: 'heart', order: 15, format: round },
  spo2Low: { label: 'Pulse Ox (low)', unit: '%', group: 'heart', order: 15.1, format: round },
  respiration: { label: 'Respiration (avg)', unit: 'brpm', group: 'heart', order: 16, format: round },
  respirationMin: { label: 'Respiration (min)', unit: 'brpm', group: 'heart', order: 16.1, format: round },
  respirationMax: { label: 'Respiration (max)', unit: 'brpm', group: 'heart', order: 16.2, format: round },

  // ── Sleep ─────────────────────────────────────────────────────────────────
  sleepMinutes: { label: 'Sleep', group: 'sleep', order: 20, format: hoursMinutes },
  sleepScore: { label: 'Sleep score', group: 'sleep', order: 21, format: round },
  deepSleepMinutes: { label: 'Deep sleep', group: 'sleep', order: 22, format: hoursMinutes },
  remSleepMinutes: { label: 'REM sleep', group: 'sleep', order: 23, format: hoursMinutes },
  lightSleepMinutes: { label: 'Light sleep', group: 'sleep', order: 24, format: hoursMinutes },
  awakeMinutes: { label: 'Awake time', group: 'sleep', order: 25, format: hoursMinutes, lowerIsBetter: true },

  // ── Training & performance ─────────────────────────────────────────────────
  vo2max: { label: 'VO₂ Max', group: 'training', order: 30, format: one },
  vo2maxCycling: { label: 'VO₂ Max (cycling)', group: 'training', order: 31, format: one },
  trainingReadiness: { label: 'Training readiness', group: 'training', order: 32, format: round },
  acuteLoad: { label: 'Acute load (7d)', group: 'training', order: 33, format: round },
  enduranceScore: { label: 'Endurance score', group: 'training', order: 34, format: round },
  hillScore: { label: 'Hill score', group: 'training', order: 35, format: round },
  fitnessAge: { label: 'Fitness age', unit: 'yr', group: 'training', order: 36, format: one, lowerIsBetter: true },
  raceTime5k: { label: 'Race predictor · 5K', group: 'training', order: 37, format: raceTime, lowerIsBetter: true },
  raceTime10k: { label: 'Race predictor · 10K', group: 'training', order: 38, format: raceTime, lowerIsBetter: true },
  raceTimeHalf: { label: 'Race predictor · Half', group: 'training', order: 39, format: raceTime, lowerIsBetter: true },
  raceTimeMarathon: { label: 'Race predictor · Marathon', group: 'training', order: 40, format: raceTime, lowerIsBetter: true },

  // ── Body composition ────────────────────────────────────────────────────────
  bmi: { label: 'BMI', group: 'body', order: 50, format: one },
  muscleMassKg: { label: 'Muscle mass', unit: 'kg', group: 'body', order: 51, format: one },
  boneMassKg: { label: 'Bone mass', unit: 'kg', group: 'body', order: 52, format: one },
  bodyWaterPct: { label: 'Body water', unit: '%', group: 'body', order: 53, format: one },
  physiqueRating: { label: 'Physique rating', group: 'body', order: 54, format: one },
  visceralFat: { label: 'Visceral fat', group: 'body', order: 55, format: one, lowerIsBetter: true },
  metabolicAge: { label: 'Metabolic age', unit: 'yr', group: 'body', order: 56, format: round, lowerIsBetter: true },
}

export const METRIC_GROUP_LABELS: Record<MetricGroup, string> = {
  training: 'Training & performance',
  heart: 'Heart & recovery',
  sleep: 'Sleep',
  activity: 'Activity',
  body: 'Body composition',
  other: 'Other',
}

const GROUP_ORDER: MetricGroup[] = ['training', 'heart', 'sleep', 'activity', 'body', 'other']

export function metricMeta(key: string): MetricMeta {
  const known = CATALOG[key]
  if (known) return { key, ...known }
  // Unknown metric: derive a readable label from a camelCase / snake_case key.
  const label = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
  return { key, label, order: 100, group: 'other' }
}

export function formatMetric(key: string, v: number): string {
  const m = metricMeta(key)
  const val = m.format ? m.format(v) : Number.isInteger(v) ? String(v) : v.toFixed(1)
  return m.unit ? `${val} ${m.unit}` : val
}

/** Order metric keys by catalog priority, then alphabetically. */
export function sortedMetricKeys(keys: string[]): string[] {
  return [...keys].sort((a, b) => {
    const d = metricMeta(a).order - metricMeta(b).order
    return d !== 0 ? d : metricMeta(a).label.localeCompare(metricMeta(b).label)
  })
}

/** Group present metric keys into ordered sections, each internally sorted. */
export function groupedMetricKeys(keys: string[]): { group: MetricGroup; label: string; keys: string[] }[] {
  const byGroup = new Map<MetricGroup, string[]>()
  for (const k of keys) {
    const g = metricMeta(k).group
    const arr = byGroup.get(g) ?? []
    arr.push(k)
    byGroup.set(g, arr)
  }
  return GROUP_ORDER.filter((g) => byGroup.has(g)).map((g) => ({
    group: g,
    label: METRIC_GROUP_LABELS[g],
    keys: sortedMetricKeys(byGroup.get(g) ?? []),
  }))
}

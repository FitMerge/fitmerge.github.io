// Catalog of known health metrics (Garmin, Apple Health, …) → display label, unit,
// formatting, grouping, and ordering. Anything NOT in the catalog still renders with a
// derived label, so new/unknown metrics need no code change.

export type MetricGroup = 'training' | 'heart' | 'sleep' | 'activity' | 'body' | 'other'

export type MetricMeta = {
  key: string
  label: string
  unit?: string
  format?: (v: number) => string
  /** Tick label for a chart axis, where there is room for ~5 characters and no
   * unit. Defaults to a rounded number with a `k` suffix over 10,000. */
  axisFormat?: (v: number) => string
  order: number
  group: MetricGroup
  /** When true, a downward trend is an improvement (resting HR, stress, race times…). */
  lowerIsBetter?: boolean
}

const round = (v: number) => String(Math.round(v))
const commas = (v: number) => Math.round(v).toLocaleString()
const one = (v: number) => v.toFixed(1)
/** Nearest half — how Garmin reports Fitness Age (e.g. 33.5), not raw decimals. */
const half = (v: number) => {
  const r = Math.round(v * 2) / 2
  return Number.isInteger(r) ? String(r) : r.toFixed(1)
}
const hoursMinutes = (v: number) => `${Math.floor(v / 60)}h ${Math.round(v % 60)}m`
/** Minutes → "7h" / "45m", for an axis where "7h 12m" does not fit. */
const axisHours = (v: number) => (Math.abs(v) >= 60 ? `${(v / 60).toFixed(v % 60 === 0 ? 0 : 1)}h` : `${Math.round(v)}m`)
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
  sleepMinutes: { label: 'Sleep', group: 'sleep', order: 20, format: hoursMinutes, axisFormat: axisHours },
  sleepScore: { label: 'Sleep score', group: 'sleep', order: 21, format: round },
  deepSleepMinutes: { label: 'Deep sleep', group: 'sleep', order: 22, format: hoursMinutes, axisFormat: axisHours },
  remSleepMinutes: { label: 'REM sleep', group: 'sleep', order: 23, format: hoursMinutes, axisFormat: axisHours },
  lightSleepMinutes: { label: 'Light sleep', group: 'sleep', order: 24, format: hoursMinutes, axisFormat: axisHours },
  awakeMinutes: { label: 'Awake time', group: 'sleep', order: 25, format: hoursMinutes, axisFormat: axisHours, lowerIsBetter: true },

  // ── Training & performance ─────────────────────────────────────────────────
  // Garmin reports VO₂ max as a whole number; showing a decimal invents precision.
  vo2max: { label: 'VO₂ Max', group: 'training', order: 30, format: round },
  vo2maxCycling: { label: 'VO₂ Max (cycling)', group: 'training', order: 31, format: round },
  trainingReadiness: { label: 'Training readiness', group: 'training', order: 32, format: round },
  acuteLoad: { label: 'Acute load (7d)', group: 'training', order: 33, format: round },
  enduranceScore: { label: 'Endurance score', group: 'training', order: 34, format: round },
  hillScore: { label: 'Hill score', group: 'training', order: 35, format: round },
  fitnessAge: { label: 'Fitness age', unit: 'yr', group: 'training', order: 36, format: half, lowerIsBetter: true },
  raceTime5k: { label: 'Race predictor · 5K', group: 'training', order: 37, format: raceTime, axisFormat: raceTime, lowerIsBetter: true },
  raceTime10k: { label: 'Race predictor · 10K', group: 'training', order: 38, format: raceTime, axisFormat: raceTime, lowerIsBetter: true },
  raceTimeHalf: { label: 'Race predictor · Half', group: 'training', order: 39, format: raceTime, axisFormat: raceTime, lowerIsBetter: true },
  raceTimeMarathon: { label: 'Race predictor · Marathon', group: 'training', order: 40, format: raceTime, axisFormat: raceTime, lowerIsBetter: true },

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
  const val = metricValue(key, v)
  return m.unit ? `${val} ${m.unit}` : val
}

/** The formatted number WITHOUT its unit — for ranges like "10–21 brpm", where
 * repeating the unit on both ends ("10 brpm–21 brpm") reads as two measurements
 * rather than one span. */
export function metricValue(key: string, v: number): string {
  const m = metricMeta(key)
  return m.format ? m.format(v) : Number.isInteger(v) ? String(v) : v.toFixed(1)
}

/**
 * A y-axis tick label. Axis ticks are not just short values — they have to be the
 * right KIND of value, and the generic "over 1,000 → 1k" rule was not. A 5K race
 * prediction is stored in seconds, so 1,500 became "2k" and the race-predictor
 * chart's axis read "1k, 2k, 3k" — a list of distances, on a chart about time.
 */
export function metricAxisValue(key: string, v: number): string {
  const m = metricMeta(key)
  if (m.axisFormat) return m.axisFormat(v)
  if (Math.abs(v) >= 10000) return `${Math.round(v / 1000)}k`
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1)}k`
  return String(Math.round(v))
}

/** Order metric keys by catalog priority, then alphabetically. */
export function sortedMetricKeys(keys: string[]): string[] {
  return [...keys].sort((a, b) => {
    const d = metricMeta(a).order - metricMeta(b).order
    return d !== 0 ? d : metricMeta(a).label.localeCompare(metricMeta(b).label)
  })
}

// --- families ---------------------------------------------------------------
//
// An import gives us 48 metrics and, until now, every one got its own tile. But
// many of them are not separate measurements at all — they are one measurement
// described several ways. Body Battery arrived as five tiles (value, high, low,
// charged, drained) where Garmin itself shows one line and two numbers;
// respiration as three where it is one reading with a spread; sleep as six where
// it is one night.
//
// A family folds those back into a single tile without dropping anything: the
// members stay reachable in the detail sheet, and no metric is ever hidden. The
// point is not to show less data — it is to stop presenting one thing as seven,
// which is what made the whole section easy to ignore.

export type FamilyKind =
  /** One reading plus the low/high it moved between — shown as "value (low–high)". */
  | 'range'
  /** A total and the parts that make it up — shown as one stacked bar. */
  | 'composition'
  /** Related readings with no arithmetic between them — shown as a list. */
  | 'list'

export type MetricFamily = {
  key: string
  label: string
  group: MetricGroup
  order: number
  kind: FamilyKind
  /** The headline reading. */
  primary: string
  /** `range`: the spread around the primary. */
  low?: string
  high?: string
  /** `composition`: the parts that make up the primary. */
  components?: string[]
  /** Further members — reachable in detail, never a tile of their own. */
  extra?: string[]
}

export const METRIC_FAMILIES: MetricFamily[] = [
  {
    key: 'bodyBattery',
    label: 'Body Battery',
    group: 'heart',
    order: 14,
    kind: 'range',
    primary: 'bodyBattery',
    low: 'bodyBatteryLow',
    high: 'bodyBatteryHigh',
    extra: ['bodyBatteryCharged', 'bodyBatteryDrained'],
  },
  {
    key: 'stress',
    label: 'Stress',
    group: 'heart',
    order: 13,
    kind: 'range',
    primary: 'stress',
    high: 'maxStress',
  },
  {
    key: 'spo2',
    label: 'Pulse Ox',
    group: 'heart',
    order: 15,
    kind: 'range',
    primary: 'spo2',
    low: 'spo2Low',
  },
  {
    key: 'respiration',
    label: 'Respiration',
    group: 'heart',
    order: 16,
    kind: 'range',
    primary: 'respiration',
    low: 'respirationMin',
    high: 'respirationMax',
  },
  {
    // Sleep score stays its own tile: it is a verdict on the night, not a part of
    // it, and it is the number most people actually look for.
    key: 'sleepMinutes',
    label: 'Sleep',
    group: 'sleep',
    order: 20,
    kind: 'composition',
    primary: 'sleepMinutes',
    // Awake time is deliberately NOT a component: Garmin's sleep total is deep +
    // REM + light, so charting awake as a slice of it would draw segments that do
    // not add up to the number printed above them.
    components: ['deepSleepMinutes', 'remSleepMinutes', 'lightSleepMinutes'],
    extra: ['awakeMinutes'],
  },
  {
    key: 'intensityMinutes',
    label: 'Intensity minutes',
    group: 'activity',
    order: 4,
    kind: 'composition',
    primary: 'intensityMinutes',
    components: ['moderateIntensityMinutes', 'vigorousIntensityMinutes'],
  },
  {
    key: 'vo2max',
    label: 'VO₂ Max',
    group: 'training',
    order: 30,
    kind: 'list',
    primary: 'vo2max',
    extra: ['vo2maxCycling'],
  },
  {
    key: 'raceTime5k',
    label: 'Race predictor',
    group: 'training',
    order: 37,
    kind: 'list',
    primary: 'raceTime5k',
    extra: ['raceTime10k', 'raceTimeHalf', 'raceTimeMarathon'],
  },
]

/** Every metric key a family covers, headline first. */
export function familyMembers(f: MetricFamily): string[] {
  return [f.primary, f.low, f.high, ...(f.components ?? []), ...(f.extra ?? [])].filter(
    (k): k is string => typeof k === 'string',
  )
}

const FAMILY_BY_MEMBER = new Map<string, MetricFamily>()
for (const f of METRIC_FAMILIES) {
  for (const k of familyMembers(f)) FAMILY_BY_MEMBER.set(k, f)
}

/** The family a metric belongs to, if any. */
export function familyFor(key: string): MetricFamily | undefined {
  return FAMILY_BY_MEMBER.get(key)
}

/** A family as it should actually be rendered, given which metrics exist. */
export type ResolvedFamily = {
  family: MetricFamily
  /** The metric the tile's headline number comes from. Usually `family.primary`,
   * but falls back to whichever member IS present so a device that reports only
   * the parts still gets a tile instead of nothing. */
  headline: string
  /** Present members, headline first — everything the detail sheet can show. */
  members: string[]
  low?: string
  high?: string
  components: string[]
}

export function resolveFamily(f: MetricFamily, present: Set<string>): ResolvedFamily | null {
  const members = familyMembers(f).filter((k) => present.has(k))
  if (members.length === 0) return null
  const headline = present.has(f.primary) ? f.primary : members[0]
  return {
    family: f,
    headline,
    members: [headline, ...members.filter((k) => k !== headline)],
    low: f.low && present.has(f.low) ? f.low : undefined,
    high: f.high && present.has(f.high) ? f.high : undefined,
    components: (f.components ?? []).filter((k) => present.has(k)),
  }
}

/** One entry per tile: either a consolidated family or a lone metric. */
export type MetricEntry =
  | { kind: 'metric'; key: string; order: number; label: string }
  | { kind: 'family'; key: string; order: number; label: string; resolved: ResolvedFamily }

/**
 * Group present metrics into ordered sections of TILES, folding families into one
 * entry each. A metric belonging to a family never also appears on its own, so
 * nothing is shown twice and nothing is lost.
 */
export function groupedMetricEntries(
  keys: string[],
): { group: MetricGroup; label: string; entries: MetricEntry[] }[] {
  const present = new Set(keys)
  const claimed = new Set<string>()
  const entries: MetricEntry[] = []

  for (const f of METRIC_FAMILIES) {
    const resolved = resolveFamily(f, present)
    if (!resolved) continue
    for (const k of resolved.members) claimed.add(k)
    entries.push({
      kind: 'family',
      key: f.key,
      order: f.order,
      label: f.label,
      resolved,
    })
  }

  for (const k of keys) {
    if (claimed.has(k)) continue
    entries.push({ kind: 'metric', key: k, order: metricMeta(k).order, label: metricMeta(k).label })
  }

  const byGroup = new Map<MetricGroup, MetricEntry[]>()
  for (const e of entries) {
    const g = e.kind === 'family' ? e.resolved.family.group : metricMeta(e.key).group
    const arr = byGroup.get(g) ?? []
    arr.push(e)
    byGroup.set(g, arr)
  }

  return GROUP_ORDER.filter((g) => byGroup.has(g)).map((g) => ({
    group: g,
    label: METRIC_GROUP_LABELS[g],
    entries: (byGroup.get(g) ?? []).sort((a, b) => a.order - b.order || a.label.localeCompare(b.label)),
  }))
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

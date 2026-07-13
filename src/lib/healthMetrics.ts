// Catalog of known health metrics (Garmin, Apple Health, …) → display label, unit,
// formatting, and ordering. Anything NOT in the catalog still renders with a
// derived label, so new/unknown metrics need no code change.

export type MetricMeta = {
  key: string
  label: string
  unit?: string
  format?: (v: number) => string
  order: number
}

const round = (v: number) => String(Math.round(v))
const commas = (v: number) => Math.round(v).toLocaleString()

const CATALOG: Record<string, Omit<MetricMeta, 'key'>> = {
  steps: { label: 'Steps', order: 1, format: commas },
  distanceKm: { label: 'Distance', unit: 'km', order: 2, format: (v) => v.toFixed(2) },
  floors: { label: 'Floors climbed', order: 3, format: round },
  intensityMinutes: { label: 'Intensity minutes', unit: 'min', order: 4, format: round },
  activeCalories: { label: 'Active calories', unit: 'kcal', order: 5, format: commas },
  totalCalories: { label: 'Total calories', unit: 'kcal', order: 6, format: commas },
  restingHr: { label: 'Resting heart rate', unit: 'bpm', order: 7, format: round },
  maxHr: { label: 'Max heart rate', unit: 'bpm', order: 8, format: round },
  hrv: { label: 'HRV', unit: 'ms', order: 9, format: round },
  stress: { label: 'Stress', order: 10, format: round },
  bodyBattery: { label: 'Body Battery', order: 11, format: round },
  sleepMinutes: { label: 'Sleep', order: 12, format: (v) => `${Math.floor(v / 60)}h ${Math.round(v % 60)}m` },
  sleepScore: { label: 'Sleep score', order: 13, format: round },
  deepSleepMinutes: { label: 'Deep sleep', order: 14, format: (v) => `${Math.floor(v / 60)}h ${Math.round(v % 60)}m` },
  remSleepMinutes: { label: 'REM sleep', order: 15, format: (v) => `${Math.floor(v / 60)}h ${Math.round(v % 60)}m` },
  spo2: { label: 'Pulse Ox', unit: '%', order: 16, format: round },
  respiration: { label: 'Respiration', unit: 'brpm', order: 17, format: round },
  vo2max: { label: 'VO₂ Max', order: 18, format: (v) => v.toFixed(1) },
  vo2maxCycling: { label: 'VO₂ Max (cycling)', order: 19, format: (v) => v.toFixed(1) },
  hydrationMl: { label: 'Hydration', unit: 'ml', order: 20, format: commas },
}

export function metricMeta(key: string): MetricMeta {
  const known = CATALOG[key]
  if (known) return { key, ...known }
  // Unknown metric: derive a readable label from a camelCase / snake_case key.
  const label = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
  return { key, label, order: 100 }
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

// Time-series helpers for imported health metrics (Garmin/Apple Health). Unlike
// the weight/volume charts (max 90 days), these support long ranges — up to
// "all" — because an import can hold years of daily data. Long ranges are
// aggregated (weekly / monthly averages) so a 5-year chart stays readable.

import { addDays, todayISO } from '../../lib/date'
import { monthDayLabel } from './utils'
import type { HealthDay } from '../../types'

export type HealthRangeKey = '30d' | '90d' | '1y' | 'all'

export const HEALTH_RANGE_OPTIONS: { key: HealthRangeKey; label: string }[] = [
  { key: '30d', label: '30d' },
  { key: '90d', label: '90d' },
  { key: '1y', label: '1y' },
  { key: 'all', label: 'All' },
]

export type MetricSample = { date: string; value: number }
export type TrendPoint = { date: string; label: string; value: number | null; avg?: number | null }

/**
 * Adds a centred/​trailing moving average (`avg`) over the non-null points, so a
 * noisy daily metric (steps, HRV, stress) gets a smooth trend line on top of the
 * raw series. `window` is the number of recent non-null points averaged.
 */
export function withMovingAverage(points: TrendPoint[], window = 7): TrendPoint[] {
  const recent: number[] = []
  return points.map((p) => {
    if (p.value === null) return { ...p, avg: null }
    recent.push(p.value)
    if (recent.length > window) recent.shift()
    const avg = recent.reduce((s, v) => s + v, 0) / recent.length
    return { ...p, avg }
  })
}

/** Sorted (oldest→newest) list of every day that recorded `key`. */
export function metricSamples(days: Record<string, HealthDay>, key: string): MetricSample[] {
  const out: MetricSample[] = []
  for (const day of Object.values(days)) {
    const v = day.metrics[key]
    if (typeof v === 'number' && Number.isFinite(v)) out.push({ date: day.date, value: v })
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : 1))
}

function monthYearLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

/** Earliest sample date, or today if there are none. */
function firstSampleDate(samples: MetricSample[]): string {
  return samples.length ? samples[0].date : todayISO()
}

/**
 * A charting series for `range`. Short ranges are one point per day (gaps = null
 * so the line connects across missing days); long ranges are bucketed and
 * averaged so the point count stays sane over years of data.
 */
export function metricSeries(samples: MetricSample[], range: HealthRangeKey): TrendPoint[] {
  if (samples.length === 0) return []
  const byDate = new Map(samples.map((s) => [s.date, s.value]))

  if (range === '30d' || range === '90d') {
    const n = range === '30d' ? 30 : 90
    const start = addDays(todayISO(), -(n - 1))
    const pts: TrendPoint[] = []
    for (let d = start; d <= todayISO(); d = addDays(d, 1)) {
      pts.push({ date: d, label: monthDayLabel(d), value: byDate.get(d) ?? null })
    }
    return pts
  }

  if (range === '1y') {
    // 52 weekly buckets, each the average of that week's samples.
    const start = addDays(todayISO(), -363)
    const pts: TrendPoint[] = []
    for (let i = 0; i < 52; i++) {
      const ws = addDays(start, i * 7)
      const we = addDays(ws, 6)
      let sum = 0
      let count = 0
      for (const s of samples) {
        if (s.date >= ws && s.date <= we) {
          sum += s.value
          count++
        }
      }
      pts.push({ date: ws, label: monthDayLabel(ws), value: count ? sum / count : null })
    }
    return pts
  }

  // 'all' → one point per calendar month that has data, averaged.
  const byMonth = new Map<string, { sum: number; count: number }>()
  for (const s of samples) {
    const ym = s.date.slice(0, 7)
    const cur = byMonth.get(ym) ?? { sum: 0, count: 0 }
    cur.sum += s.value
    cur.count++
    byMonth.set(ym, cur)
  }
  return Array.from(byMonth.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([ym, v]) => ({ date: `${ym}-01`, label: monthYearLabel(`${ym}-01`), value: v.sum / v.count }))
}

/** Raw values recorded within `range`, oldest→newest. */
export function valuesInRange(samples: MetricSample[], range: HealthRangeKey): number[] {
  const start =
    range === 'all'
      ? firstSampleDate(samples)
      : addDays(todayISO(), -(range === '30d' ? 29 : range === '90d' ? 89 : 364))
  return samples.filter((s) => s.date >= start && s.date <= todayISO()).map((s) => s.value)
}

export type TypicalRange = { low: number; high: number; mid: number }

/**
 * The user's "typical range" for a metric over `range` — the central band most of
 * their readings fall in (15th–85th percentile) plus the median. Drawn as a shaded
 * band behind trend charts so a value reads as in / above / below normal at a glance
 * (the Apple Health "typical range" / Oura baseline pattern). Null until there are
 * enough readings to define a normal.
 */
export function typicalRange(samples: MetricSample[], range: HealthRangeKey): TypicalRange | null {
  return typicalRangeOf(valuesInRange(samples, range))
}

/** typicalRange from a bare number series (e.g. a tile's sparkline values). */
export function typicalRangeOf(values: number[]): TypicalRange | null {
  if (values.length < 6) return null
  const sorted = [...values].sort((a, b) => a - b)
  const at = (p: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))))]
  const mid =
    sorted.length % 2
      ? sorted[(sorted.length - 1) / 2]
      : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
  return { low: at(0.15), high: at(0.85), mid }
}

/** Where the latest reading sits relative to the typical band. */
export function bandPosition(value: number, band: TypicalRange): 'above' | 'below' | 'within' {
  if (value > band.high) return 'above'
  if (value < band.low) return 'below'
  return 'within'
}

export type MetricStats = { min: number; max: number; avg: number; first: number; last: number; count: number }

/** Min/avg/max and first→last delta over the raw samples within `range`. */
export function metricStats(samples: MetricSample[], range: HealthRangeKey): MetricStats | null {
  const start =
    range === 'all'
      ? firstSampleDate(samples)
      : addDays(todayISO(), -(range === '30d' ? 29 : range === '90d' ? 89 : 364))
  const inRange = samples.filter((s) => s.date >= start && s.date <= todayISO())
  if (inRange.length === 0) return null

  let min = Infinity
  let max = -Infinity
  let sum = 0
  for (const s of inRange) {
    if (s.value < min) min = s.value
    if (s.value > max) max = s.value
    sum += s.value
  }
  return {
    min,
    max,
    avg: sum / inRange.length,
    first: inRange[0].value,
    last: inRange[inRange.length - 1].value,
    count: inRange.length,
  }
}

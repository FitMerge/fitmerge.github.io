// Premium weight-tracking helpers: a smoothed trend line over noisy daily weigh-ins
// (the single most useful view in apps like Happy Scale / Libra / MacroFactor), a
// rate-of-change per week, and a projection to a goal weight. Weight history can span
// years, so — like the health metrics — this supports long ranges beyond the shared
// 90-day nutrition/volume selector.

import { convertWeight } from '../../lib/units'
import { monthDayLabel } from './utils'
import type { BodyEntry, Units } from '../../types'

export type WeightRangeKey = '30d' | '90d' | '6m' | '1y' | 'all'

export const WEIGHT_RANGE_OPTIONS: { key: WeightRangeKey; label: string; days: number }[] = [
  { key: '30d', label: '30d', days: 30 },
  { key: '90d', label: '90d', days: 90 },
  { key: '6m', label: '6m', days: 182 },
  { key: '1y', label: '1y', days: 365 },
  { key: 'all', label: 'All', days: Number.POSITIVE_INFINITY },
]

export type WeightTrendPoint = {
  date: string
  label: string
  /** Actual weigh-in for the day, in display units (null on days with no entry). */
  weight: number | null
  /** Exponential moving-average trend, in display units. */
  trend: number | null
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000)
}

/**
 * Points within `range`, each carrying the raw weigh-in and an EMA trend. The EMA is
 * warmed up over ALL earlier entries so the trend at the start of the visible range is
 * already smooth, not anchored to the first visible point.
 */
export function weightTrendData(entries: BodyEntry[], range: WeightRangeKey, units: Units): WeightTrendPoint[] {
  const asc = [...entries].sort((a, b) => (a.date < b.date ? -1 : 1))
  if (asc.length === 0) return []

  // EMA with a ~10-sample smoothing constant — enough to cut daily water-weight noise
  // without lagging a real trend by weeks.
  const alpha = 2 / (10 + 1)
  const trendByDate = new Map<string, number>()
  let ema: number | null = null
  for (const e of asc) {
    const w = convertWeight(e.weightKg, units)
    ema = ema === null ? w : ema + alpha * (w - ema)
    trendByDate.set(e.date, ema)
  }

  const opt = WEIGHT_RANGE_OPTIONS.find((o) => o.key === range) ?? WEIGHT_RANGE_OPTIONS[1]
  const cutoffDays = opt.days
  const lastDate = asc[asc.length - 1].date
  const inRange =
    cutoffDays === Number.POSITIVE_INFINITY ? asc : asc.filter((e) => daysBetween(e.date, lastDate) <= cutoffDays)

  return inRange.map((e) => ({
    date: e.date,
    label: monthDayLabel(e.date),
    weight: convertWeight(e.weightKg, units),
    trend: trendByDate.get(e.date) ?? null,
  }))
}

export type WeightStats = {
  latest: number
  trend: number
  /** Trend change across the visible range (display units; negative = losing). */
  change: number
  /** Trend slope in display units per week. */
  ratePerWeek: number
  count: number
  /** Signed distance from trend to goal (display units); positive = above goal. */
  toGoal: number | null
  /** Projected ISO date the trend reaches the goal, if currently moving toward it. */
  projectedDate: string | null
}

/** Summary stats over the visible range. `goalDisplay` is the goal weight in display units. */
export function weightStats(
  entries: BodyEntry[],
  range: WeightRangeKey,
  units: Units,
  goalDisplay?: number,
): WeightStats | null {
  const pts = weightTrendData(entries, range, units)
  if (pts.length === 0) return null
  const first = pts[0]
  const last = pts[pts.length - 1]
  const trend = last.trend ?? last.weight ?? 0
  const firstTrend = first.trend ?? first.weight ?? trend
  const change = trend - firstTrend
  const spanDays = daysBetween(first.date, last.date)
  const ratePerWeek = spanDays > 0 ? (change / spanDays) * 7 : 0

  let toGoal: number | null = null
  let projectedDate: string | null = null
  if (goalDisplay !== undefined) {
    toGoal = trend - goalDisplay
    const movingToward = (toGoal > 0 && ratePerWeek < 0) || (toGoal < 0 && ratePerWeek > 0)
    if (movingToward && ratePerWeek !== 0) {
      const weeks = Math.abs(toGoal / ratePerWeek)
      if (weeks < 520) {
        const d = new Date(last.date)
        d.setDate(d.getDate() + Math.round(weeks * 7))
        projectedDate = d.toISOString().slice(0, 10)
      }
    }
  }

  return {
    latest: last.weight ?? trend,
    trend,
    change,
    ratePerWeek,
    count: pts.length,
    toGoal,
    projectedDate,
  }
}

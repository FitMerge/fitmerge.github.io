// Helpers for the Health tab's "today" snapshot: latest value + recent sparkline per
// metric, activity-goal progress, and status colours (green/amber/red) matching the
// convention used by Garmin Connect / Whoop status cards.

import type { HealthDay } from '../../types'

/** Daily activity goals used for the ring gauges (sensible defaults). */
export const ACTIVITY_GOALS = { steps: 10_000, floors: 10, intensityMinutes: 30 }

export type LatestMetric = { value: number; date: string }

/** Most recent value for `key`. `daysDesc` must be newest-first. */
export function latestMetric(daysDesc: HealthDay[], key: string): LatestMetric | null {
  for (const day of daysDesc) {
    const v = day.metrics[key]
    if (typeof v === 'number' && Number.isFinite(v)) return { value: v, date: day.date }
  }
  return null
}

/** Recent values for `key`, oldest→newest, for a sparkline (≤ `n` points). */
export function metricSpark(daysDesc: HealthDay[], key: string, n = 14): number[] {
  const out: number[] = []
  for (const day of daysDesc) {
    const v = day.metrics[key]
    if (typeof v === 'number' && Number.isFinite(v)) out.push(v)
    if (out.length >= n) break
  }
  return out.reverse()
}

/** Traffic-light colour for a 0–100 score (Body Battery, readiness, sleep score). */
export function scoreColor(v: number): string {
  if (v >= 66) return '#34d399' // emerald
  if (v >= 33) return '#fbbf24' // amber
  return '#f43f5e' // rose
}

/** Colour for goal-based progress: greens as you approach/clear the goal. */
export function goalColor(pct: number): string {
  if (pct >= 1) return '#34d399'
  if (pct >= 0.6) return '#38bdf8' // sky
  return '#64748b' // slate
}

export type HeroPick = { key: string; label: string; value: number; date: string }

/**
 * The single most important "how am I today" score to headline the tab — Body Battery
 * if the watch reports it, else training readiness, else sleep score.
 */
export function heroScore(daysDesc: HealthDay[]): HeroPick | null {
  const candidates: { key: string; label: string }[] = [
    { key: 'bodyBattery', label: 'Body Battery' },
    { key: 'trainingReadiness', label: 'Training readiness' },
    { key: 'sleepScore', label: 'Sleep score' },
  ]
  for (const c of candidates) {
    const m = latestMetric(daysDesc, c.key)
    if (m) return { key: c.key, label: c.label, value: m.value, date: m.date }
  }
  return null
}

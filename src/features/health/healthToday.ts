// Helpers for the Health tab's "today" snapshot: latest value + recent sparkline per
// metric, activity-goal progress, and status colours (green/amber/red) matching the
// convention used by Garmin Connect / Whoop status cards.

import type { HealthDay } from '../../types'
import { formatMetric, metricMeta } from '../../lib/healthMetrics'
import { bandPosition, typicalRangeOf } from '../progress/healthTrends'

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

/** One-word read of a 0–100 score, for the hero sublabel. */
export function scoreWord(v: number): string {
  if (v >= 66) return 'Well recovered'
  if (v >= 33) return 'Moderate'
  return 'Low — take it easy'
}

export type Highlight = {
  key: string
  label: string
  /** Latest value, formatted with its unit. */
  value: string
  /** Plain-language read vs the personal baseline, e.g. "3 bpm below normal". */
  note: string
  tone: 'good' | 'bad' | 'neutral'
}

/**
 * "This morning" highlights for a curated set of recovery metrics, each interpreted
 * against the user's own recent baseline (Apple Health "typical range" / Oura
 * baseline pattern) so a value reads as better/worse than normal — not in the abstract.
 */
export function todayHighlights(daysDesc: HealthDay[]): Highlight[] {
  const keys = ['sleepMinutes', 'restingHr', 'hrv', 'stress']
  const out: Highlight[] = []
  for (const key of keys) {
    const latest = latestMetric(daysDesc, key)
    if (!latest) continue

    // Baseline = up to 28 prior readings, skipping today's own so a value is never
    // compared against a baseline it is part of.
    const prior: number[] = []
    let skippedLatest = false
    for (const day of daysDesc) {
      const v = day.metrics[key]
      if (typeof v !== 'number' || !Number.isFinite(v)) continue
      if (!skippedLatest) {
        skippedLatest = true
        continue
      }
      prior.push(v)
      if (prior.length >= 28) break
    }

    let note = 'logged today'
    let tone: Highlight['tone'] = 'neutral'
    // Significance is the metric's own spread, matching healthStory: a reading is
    // only remarkable once it leaves the middle 70% of that metric's own recent
    // history. The previous fixed 5% threshold fired constantly on naturally noisy
    // metrics — HRV swings 20% night to night — so "below normal" appeared most
    // days and stopped meaning anything.
    const band = typicalRangeOf(prior)
    if (band) {
      const pos = bandPosition(latest.value, band)
      if (pos === 'within') {
        note = 'in your normal range'
      } else {
        const delta = latest.value - band.mid
        const improving = metricMeta(key).lowerIsBetter ? delta < 0 : delta > 0
        tone = improving ? 'good' : 'bad'
        note = `${formatMetric(key, Math.abs(delta))} ${pos} normal`
      }
    }
    out.push({ key, label: LABELS[key] ?? metricMeta(key).label, value: formatMetric(key, latest.value), note, tone })
  }
  return out
}

/** Short names for the home tiles, where "Resting heart rate" does not fit. */
const LABELS: Record<string, string> = {
  sleepMinutes: 'Sleep',
  restingHr: 'Resting HR',
  hrv: 'HRV',
  stress: 'Stress',
}

// Per-exercise progress: what you actually lifted, over time.
//
// Every metric here is a measured number rather than a modelled one. Estimated
// 1RM is deliberately absent: it is a formula's guess at a lift you did not
// perform, and while that makes it the only fair way to RANK different rep
// ranges against each other (which is why the records card still uses it), it is
// the wrong thing to plot when the question is "what have I been lifting".

import { addDays, todayISO } from '../../lib/date'
import { isWorkingSet } from '../workouts/utils'
import { monthDayLabel } from './utils'
import type { WorkoutSession } from '../../types'

export type LiftMetric = 'heaviest' | 'bestSet' | 'sessionVolume'

export const LIFT_METRICS: {
  key: LiftMetric
  /** Segmented-control label — must stay short enough for three across a phone. */
  label: string
  /** What the number means, in the chart caption. */
  help: string
  /** True when the value is a volume (weight × reps) rather than a weight. */
  isVolume: boolean
}[] = [
  {
    key: 'heaviest',
    label: 'Heaviest',
    help: 'The heaviest weight you put on the bar that session, whatever the reps.',
    isVolume: false,
  },
  {
    key: 'bestSet',
    label: 'Best set',
    help: 'Your single best set that session — weight × reps. Rewards a hard set without counting how many you did.',
    isVolume: true,
  },
  {
    key: 'sessionVolume',
    label: 'Session total',
    help: 'Every working set of this exercise added up. Work capacity rather than peak strength — note it rises if you simply add a set.',
    isVolume: true,
  },
]

export function liftMetricMeta(metric: LiftMetric) {
  return LIFT_METRICS.find((m) => m.key === metric) ?? LIFT_METRICS[0]
}

export type LiftPoint = {
  date: string
  label: string
  /** The metric's value for this session. */
  value: number
  /** Working sets performed, for context under the headline number. */
  sets: number
  /** The session's top set, so a volume number can still say what was lifted. */
  topWeight: number
  topReps: number
}

/** Ranges for the exercise chart. Longer than the shared progress ranges, because
 * strength moves over months and a 30-day window on a twice-weekly lift is eight
 * points. */
export type LiftRangeKey = '90d' | '6m' | '1y' | 'all'

export const LIFT_RANGE_OPTIONS: { key: LiftRangeKey; label: string }[] = [
  { key: '90d', label: '90d' },
  { key: '6m', label: '6m' },
  { key: '1y', label: '1y' },
  { key: 'all', label: 'All' },
]

const RANGE_DAYS: Record<Exclude<LiftRangeKey, 'all'>, number> = { '90d': 90, '6m': 182, '1y': 365 }

export function liftRangeStart(range: LiftRangeKey): string {
  if (range === 'all') return '0000-01-01'
  return addDays(todayISO(), -(RANGE_DAYS[range] - 1))
}

/** One point per finished session containing the exercise, oldest → newest. */
export function exerciseSeries(
  sessions: WorkoutSession[],
  exerciseId: string,
  metric: LiftMetric,
  range: LiftRangeKey,
): LiftPoint[] {
  const start = liftRangeStart(range)
  const out: LiftPoint[] = []

  for (const session of sessions) {
    if (!session.finishedAt || session.date < start || session.date > todayISO()) continue
    const entry = session.entries.find((e) => e.exerciseId === exerciseId)
    if (!entry) continue

    let heaviest = 0
    let bestSet = 0
    let total = 0
    let sets = 0
    let topWeight = 0
    let topReps = 0
    for (const set of entry.sets) {
      if (!isWorkingSet(set)) continue
      sets++
      const volume = set.weight * set.reps
      total += volume
      if (set.weight > topWeight) {
        topWeight = set.weight
        topReps = set.reps
      }
      if (set.weight > heaviest) heaviest = set.weight
      if (volume > bestSet) bestSet = volume
    }
    if (sets === 0) continue

    const value = metric === 'heaviest' ? heaviest : metric === 'bestSet' ? bestSet : total
    out.push({ date: session.date, label: monthDayLabel(session.date), value, sets, topWeight, topReps })
  }

  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}

export type ExerciseSummary = {
  exerciseId: string
  /** Sessions containing this exercise inside the range. */
  sessions: number
  lastDate: string
  first: number
  last: number
  best: number
  /** Sparkline data — the metric's value per session. */
  values: number[]
}

/**
 * Every exercise trained in the range, summarised for the chosen metric and
 * ordered by most recently trained. Recency, not size: after a workout the lifts
 * you just did should be the ones at the top, which is the failure the records
 * card had when it ranked by weight.
 */
export function exerciseSummaries(
  sessions: WorkoutSession[],
  metric: LiftMetric,
  range: LiftRangeKey,
): ExerciseSummary[] {
  const start = liftRangeStart(range)
  const ids = new Set<string>()
  for (const session of sessions) {
    if (!session.finishedAt || session.date < start || session.date > todayISO()) continue
    for (const entry of session.entries) {
      if (entry.sets.some(isWorkingSet)) ids.add(entry.exerciseId)
    }
  }

  const out: ExerciseSummary[] = []
  for (const exerciseId of ids) {
    const points = exerciseSeries(sessions, exerciseId, metric, range)
    if (points.length === 0) continue
    out.push({
      exerciseId,
      sessions: points.length,
      lastDate: points[points.length - 1].date,
      first: points[0].value,
      last: points[points.length - 1].value,
      best: points.reduce((m, p) => Math.max(m, p.value), 0),
      values: points.map((p) => p.value),
    })
  }

  return out.sort((a, b) => (a.lastDate !== b.lastDate ? (a.lastDate < b.lastDate ? 1 : -1) : b.last - a.last))
}

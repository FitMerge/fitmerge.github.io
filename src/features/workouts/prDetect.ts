// Pure personal-record detection for a single completed set. Kept side-effect
// free so it's easy to unit-test; the caller supplies the bars to beat (the max
// of all-time history and what's already been hit earlier in this session).

import { epley1RM } from '../progress/utils'

export type PRKind = '1rm' | 'weight' | 'volume'

export type PRHit = { kind: PRKind; value: number }

/** Bars a set must clear to count as a record — max(all-time, this-session-so-far). */
export type PRBars = { best1rm: number; bestWeight: number; bestVolume: number }

const LABELS: Record<PRKind, string> = {
  '1rm': 'Estimated 1RM',
  weight: 'Heaviest weight',
  volume: 'Best set',
}

export function prLabel(kind: PRKind): string {
  return LABELS[kind]
}

/**
 * Records set by `weight × reps`, given the current bars. Only fires when a bar
 * is > 0 (i.e. there's history to beat) so the very first time you do an
 * exercise doesn't spam a record for every set.
 */
export function detectPRs(weight: number, reps: number, bars: PRBars): PRHit[] {
  const hits: PRHit[] = []
  if (weight <= 0 || reps <= 0) return hits

  const est = epley1RM(weight, reps)
  const volume = weight * reps

  if (bars.best1rm > 0 && est > bars.best1rm) hits.push({ kind: '1rm', value: Math.round(est) })
  if (bars.bestWeight > 0 && weight > bars.bestWeight) hits.push({ kind: 'weight', value: weight })
  if (bars.bestVolume > 0 && volume > bars.bestVolume) hits.push({ kind: 'volume', value: Math.round(volume) })
  return hits
}

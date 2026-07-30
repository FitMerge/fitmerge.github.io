// Habit weights for a challenge, as whole percentages of the day.
//
// The editor works in integers because "workout 20%, reading 5%" is how people
// actually talk about it, and a spinner that lands on 16.666% reads as broken.
// Integers don't always divide evenly, so `equalSplit` distributes the remainder
// rather than leaving a total of 99.

import { DAY_POINTS } from './scoring'

export type WeightMap = Record<string, number>

/**
 * An even split across `ids` totalling exactly DAY_POINTS. Three habits become
 * 34/33/33 rather than 33/33/33 — the extra point goes to the earliest habits,
 * which is arbitrary but stable, so the same list always splits the same way.
 */
export function equalSplit(ids: string[]): WeightMap {
  if (ids.length === 0) return {}
  const base = Math.floor(DAY_POINTS / ids.length)
  let remainder = DAY_POINTS - base * ids.length
  const out: WeightMap = {}
  for (const id of ids) {
    out[id] = base + (remainder > 0 ? 1 : 0)
    if (remainder > 0) remainder--
  }
  return out
}

export function totalWeight(weights: WeightMap): number {
  return Object.values(weights).reduce((sum, w) => sum + (Number.isFinite(w) ? w : 0), 0)
}

/** How far from a valid 100% the current edit is. Positive = still to allocate. */
export function remainingWeight(weights: WeightMap): number {
  return DAY_POINTS - totalWeight(weights)
}

export function isBalanced(weights: WeightMap): boolean {
  return Object.keys(weights).length > 0 && totalWeight(weights) === DAY_POINTS
}

/**
 * Rescale an unbalanced edit back to exactly DAY_POINTS while keeping the
 * proportions the user set — the "Balance" button.
 *
 * Scaling produces fractions, so the rounded values are corrected by handing the
 * leftover to the largest weights. Nudging the biggest habit by a point is far
 * less noticeable than nudging a 5% one, and it guarantees the total lands on
 * 100 rather than 99 or 101.
 */
export function balance(weights: WeightMap): WeightMap {
  const ids = Object.keys(weights)
  if (ids.length === 0) return {}
  const sum = totalWeight(weights)
  if (sum <= 0) return equalSplit(ids)

  const scaled = ids.map((id) => ({ id, exact: (Math.max(0, weights[id] ?? 0) * DAY_POINTS) / sum }))
  const out: WeightMap = {}
  for (const { id, exact } of scaled) out[id] = Math.floor(exact)

  let leftover = DAY_POINTS - totalWeight(out)
  // Largest fractional part first — standard largest-remainder apportionment,
  // so the rounding error is spread the way a person would spread it.
  const byFraction = [...scaled].sort((a, b) => (b.exact % 1) - (a.exact % 1))
  let i = 0
  while (leftover > 0 && byFraction.length > 0) {
    const entry = byFraction[i % byFraction.length]
    out[entry.id] = (out[entry.id] ?? 0) + 1
    leftover--
    i++
  }
  return out
}

/**
 * Add or remove a habit from the selection, re-splitting evenly.
 *
 * Deliberately re-splits rather than preserving custom weights: after ticking a
 * seventh habit the old numbers total 100 without it, so keeping them would
 * silently give the new habit 0% and make it look broken. Someone who has hand-
 * tuned their weights re-tunes them; someone who hasn't gets a sane default.
 */
export function toggleHabit(weights: WeightMap, id: string): WeightMap {
  const ids = Object.keys(weights)
  const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]
  return equalSplit(next)
}

/** Set one weight, clamped to 0..DAY_POINTS. Does not rebalance the others. */
export function setWeight(weights: WeightMap, id: string, value: number): WeightMap {
  if (!(id in weights)) return weights
  const clamped = Math.max(0, Math.min(DAY_POINTS, Math.round(value)))
  return { ...weights, [id]: clamped }
}

/**
 * Drop weights whose habit no longer exists, then rebalance.
 *
 * A habit deleted from the daily checklist would otherwise keep its share of the
 * day forever — unreachable points that make a perfect day impossible.
 */
export function pruneWeights(weights: WeightMap, liveIds: string[]): WeightMap {
  const live = new Set(liveIds)
  const kept = Object.keys(weights).filter((id) => live.has(id))
  if (kept.length === Object.keys(weights).length) return weights
  if (kept.length === 0) return {}
  return balance(Object.fromEntries(kept.map((id) => [id, weights[id] ?? 0])))
}

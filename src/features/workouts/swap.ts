// Ranks comparable exercises to swap in for a given one — e.g. when you don't
// have the equipment a routine calls for. Comparability is driven by shared
// muscles (primary overlap weighs most), then the broad muscle group; equipment
// you own floats to the top.

import { EXERCISES, getExerciseById } from '../../data/exercises'
import { hasEquipment } from '../../data/equipment'
import type { Exercise } from '../../types'

export type SwapSuggestion = {
  exercise: Exercise
  score: number
  matchLabel: string
  available: boolean
}

function overlap(a: string[] | undefined, b: string[] | undefined): number {
  if (!a || !b) return 0
  const set = new Set(a)
  let n = 0
  for (const x of b) if (set.has(x)) n++
  return n
}

/**
 * Comparable alternatives to `fromId`, best first. `available` is the user's
 * owned-equipment list (undefined = everything). Candidates need either a shared
 * primary muscle or the same muscle group to qualify.
 */
export function suggestSwaps(fromId: string, available: string[] | undefined, limit = 24): SwapSuggestion[] {
  const from = getExerciseById(fromId)
  if (!from) return []
  const fromPrimary = from.primaryMuscles ?? []
  const fromSecondary = from.secondaryMuscles ?? []

  const scored: SwapSuggestion[] = []
  for (const ex of EXERCISES) {
    if (ex.id === from.id) continue
    const primaryHits = overlap(fromPrimary, ex.primaryMuscles)
    const sameGroup = ex.muscleGroup === from.muscleGroup
    if (primaryHits === 0 && !sameGroup) continue

    const crossHits = overlap(fromPrimary, ex.secondaryMuscles) + overlap(fromSecondary, ex.primaryMuscles)
    const secondaryHits = overlap(fromSecondary, ex.secondaryMuscles)
    const score = primaryHits * 5 + (sameGroup ? 3 : 0) + crossHits * 1.5 + secondaryHits * 0.5

    const matchLabel =
      fromPrimary.length > 0 && primaryHits >= fromPrimary.length
        ? 'Same muscles'
        : primaryHits > 0
          ? 'Similar muscles'
          : 'Same muscle group'

    scored.push({ exercise: ex, score, matchLabel, available: hasEquipment(ex.equipment, available) })
  }

  scored.sort((a, b) => {
    if (a.available !== b.available) return a.available ? -1 : 1
    if (b.score !== a.score) return b.score - a.score
    return a.exercise.name.localeCompare(b.exercise.name)
  })
  return scored.slice(0, limit)
}

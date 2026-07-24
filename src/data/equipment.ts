// Equipment vocabulary + the "what do I own" check that powers exercise swaps.
// The list is derived from the exercise library so it never drifts out of sync.

import { EXERCISES } from './exercises'

// Preferred display order; anything in the data but not listed here is appended.
const ORDER = ['Barbell', 'Dumbbell', 'Kettlebell', 'Machine', 'Cable', 'Cardio machine', 'Bodyweight', 'Other']

/** One-line examples so users can map their real gear to each category. */
export const EQUIPMENT_HELP: Record<string, string> = {
  Barbell: 'Bars, plates & collars — incl. curl/trap bars',
  Dumbbell: 'Fixed or adjustable dumbbells',
  Kettlebell: 'Any kettlebells',
  Machine: 'Plate/pin-loaded machines (leg press, lat pulldown…)',
  Cable: 'Cable stack / functional trainer',
  'Cardio machine': 'Bike, rower, treadmill, elliptical',
  Other: 'Jump rope & misc.',
}

export const EQUIPMENT_TYPES: string[] = (() => {
  const present = new Set(EXERCISES.map((e) => e.equipment))
  const ordered = ORDER.filter((t) => present.has(t))
  for (const t of present) if (!ordered.includes(t)) ordered.push(t)
  return ordered
})()

/** Equipment the user can toggle as owned. Bodyweight is always available, so it
 * isn't offered as a checkbox. */
export const TOGGLEABLE_EQUIPMENT: string[] = EQUIPMENT_TYPES.filter((t) => t !== 'Bodyweight')

/**
 * Whether an exercise's equipment is available to the user.
 * - Bodyweight is always available (you always have your body).
 * - `available === undefined` means no preference set → everything counts.
 * - Otherwise only equipment in the list counts.
 */
export function hasEquipment(equipment: string, available: string[] | undefined): boolean {
  if (equipment === 'Bodyweight') return true
  if (!available) return true
  return available.includes(equipment)
}

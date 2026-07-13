// Muscle taxonomy for exercise demonstrations (Hevy-style worked-muscle map).
// Keep this list stable — exercise annotations in `exercises.ts` and the SVG
// regions in `MuscleMap.tsx` both key off these exact ids.

export type MuscleId =
  | 'chest'
  | 'frontDelts'
  | 'sideDelts'
  | 'rearDelts'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'abs'
  | 'obliques'
  | 'traps'
  | 'lats'
  | 'upperBack'
  | 'lowerBack'
  | 'glutes'
  | 'quads'
  | 'hamstrings'
  | 'calves'
  | 'adductors'

export const MUSCLE_LABELS: Record<MuscleId, string> = {
  chest: 'Chest',
  frontDelts: 'Front delts',
  sideDelts: 'Side delts',
  rearDelts: 'Rear delts',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  abs: 'Abs',
  obliques: 'Obliques',
  traps: 'Traps',
  lats: 'Lats',
  upperBack: 'Upper back',
  lowerBack: 'Lower back',
  glutes: 'Glutes',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  calves: 'Calves',
  adductors: 'Adductors',
}

/** Muscles shown on the front-facing figure; the rest render on the back figure. */
export const FRONT_MUSCLES: ReadonlySet<MuscleId> = new Set<MuscleId>([
  'chest',
  'frontDelts',
  'sideDelts',
  'biceps',
  'forearms',
  'abs',
  'obliques',
  'quads',
  'adductors',
])

export const BACK_MUSCLES: ReadonlySet<MuscleId> = new Set<MuscleId>([
  'traps',
  'rearDelts',
  'sideDelts',
  'lats',
  'upperBack',
  'lowerBack',
  'triceps',
  'forearms',
  'glutes',
  'hamstrings',
  'calves',
])

export function muscleLabel(id: MuscleId): string {
  return MUSCLE_LABELS[id]
}

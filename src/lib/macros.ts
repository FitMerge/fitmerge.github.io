import type { Macros } from '../types'

export function emptyMacros(): Macros {
  return { calories: 0, protein: 0, carbs: 0, fat: 0 }
}

export function sumMacros(list: Macros[]): Macros {
  return list.reduce<Macros>(
    (acc, m) => ({
      calories: acc.calories + m.calories,
      protein: acc.protein + m.protein,
      carbs: acc.carbs + m.carbs,
      fat: acc.fat + m.fat,
    }),
    emptyMacros(),
  )
}

export function caloriesFromMacros({
  protein,
  carbs,
  fat,
}: Pick<Macros, 'protein' | 'carbs' | 'fat'>): number {
  return protein * 4 + carbs * 4 + fat * 9
}

export function macroPct(part: number, goal: number): number {
  if (goal <= 0) return 0
  return Math.min(1, Math.max(0, part / goal))
}

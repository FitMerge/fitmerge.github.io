// Re-log a meal you have already logged.
//
// A real breakfast is not one food, it is eleven: eggs, five veggies, turkey,
// home fries, cottage cheese, shredded cheese, hot sauce, salsa, coffee, protein
// powder. Logging that by searching for each item takes minutes, and you eat a
// variation of it most mornings. "Recent foods" does not help — it hands back
// eleven separate rows with no memory that they were one plate.
//
// So the unit of reuse here is the DAY's meal, kept intact, with the amounts you
// actually logged. Everything after that is subtraction: uncheck what you didn't
// have, adjust what was a different size.

import type { FoodEntry, Macros, MealType } from '../../types'

export type PastMealItem = {
  name: string
  qty: number
  unit: string
} & Macros

export type PastMeal = {
  date: string
  mealType: MealType
  items: PastMealItem[]
  /** Total for the whole meal as originally logged. */
  calories: number
}

function toItem(entry: FoodEntry): PastMealItem {
  return {
    name: entry.name,
    qty: entry.qty,
    unit: entry.unit,
    calories: entry.calories,
    protein: entry.protein,
    carbs: entry.carbs,
    fat: entry.fat,
  }
}

type Options = {
  /**
   * The day being logged into. Excluded from the list: offering to copy today's
   * breakfast into today's breakfast is never what anyone means, and it would sit
   * at the top of the list every time.
   */
  excludeDate?: string
  /** Days offered. Two weeks is enough to find "the one with the salsa". */
  limit?: number
}

/**
 * Past instances of `mealType`, one per day, most recent first.
 *
 * Days where that meal was empty do not appear — an empty card is a dead tap.
 */
export function pastMeals(
  entries: FoodEntry[],
  mealType: MealType,
  { excludeDate, limit = 14 }: Options = {},
): PastMeal[] {
  const byDate = new Map<string, PastMealItem[]>()

  for (const entry of entries) {
    if (entry.mealType !== mealType) continue
    if (entry.date === excludeDate) continue
    const day = byDate.get(entry.date)
    if (day) day.push(toItem(entry))
    else byDate.set(entry.date, [toItem(entry)])
  }

  return Array.from(byDate.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .slice(0, limit)
    .map(([date, items]) => ({
      date,
      mealType,
      items,
      calories: items.reduce((sum, i) => sum + i.calories, 0),
    }))
}

/**
 * A one-line preview of what was on the plate, for the day card.
 *
 * Names only, no amounts: the point is recognising WHICH breakfast this was at a
 * glance, and "3 eggs, 1 cup mixed veggies, 4 oz ground turkey" spends the whole
 * line on three items.
 */
export function mealSummary(items: PastMealItem[], max = 4): string {
  const names = items.map((i) => i.name.trim()).filter(Boolean)
  if (names.length === 0) return 'Nothing logged'
  const shown = names.slice(0, max).join(', ')
  const rest = names.length - max
  return rest > 0 ? `${shown} +${rest} more` : shown
}

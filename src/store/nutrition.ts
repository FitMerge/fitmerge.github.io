import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { uid } from '../lib/id'
import type { CustomFood, FoodEntry, SavedMeal, SavedMealItem } from '../types'

type NutritionState = {
  entries: FoodEntry[]
  customFoods: CustomFood[]
  savedMeals: SavedMeal[]
  addEntry: (entry: Omit<FoodEntry, 'id'>) => void
  updateEntry: (id: string, patch: Partial<FoodEntry>) => void
  removeEntry: (id: string) => void
  addCustomFood: (food: Omit<CustomFood, 'id'>) => void
  addSavedMeal: (meal: Omit<SavedMeal, 'id'>) => void
  removeSavedMeal: (id: string) => void
}

export const useNutritionStore = create<NutritionState>()(
  persist(
    (set, get) => ({
      entries: [],
      customFoods: [],
      savedMeals: [],
      addEntry: (entry) => {
        set({ entries: [...get().entries, { ...entry, id: uid() }] })
      },
      updateEntry: (id, patch) => {
        set({
          entries: get().entries.map((e) => (e.id === id ? { ...e, ...patch } : e)),
        })
      },
      removeEntry: (id) => {
        set({ entries: get().entries.filter((e) => e.id !== id) })
      },
      addCustomFood: (food) => {
        set({ customFoods: [...get().customFoods, { ...food, id: uid() }] })
      },
      addSavedMeal: (meal) => {
        set({ savedMeals: [...get().savedMeals, { ...meal, id: uid() }] })
      },
      removeSavedMeal: (id) => {
        set({ savedMeals: get().savedMeals.filter((m) => m.id !== id) })
      },
    }),
    { name: 'fm-nutrition' },
  ),
)

export function entriesForDate(entries: FoodEntry[], date: string): FoodEntry[] {
  return entries.filter((e) => e.date === date)
}

function toSavedMealItem(entry: FoodEntry): SavedMealItem {
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

// More recent = later date, and among same-date entries, later insertion (higher index).
function isMoreRecent(a: FoodEntry, aIndex: number, b: FoodEntry, bIndex: number): boolean {
  if (a.date !== b.date) return a.date > b.date
  return aIndex > bIndex
}

/**
 * Dedupe entries by lowercase name, keeping the most recent occurrence's
 * macros/qty/unit. Sorted newest first (by date, then insertion order).
 */
export function recentFoods(entries: FoodEntry[], limit = 12): SavedMealItem[] {
  const mostRecent = new Map<string, { entry: FoodEntry; index: number }>()

  entries.forEach((entry, index) => {
    const key = entry.name.trim().toLowerCase()
    const existing = mostRecent.get(key)
    if (!existing || isMoreRecent(entry, index, existing.entry, existing.index)) {
      mostRecent.set(key, { entry, index })
    }
  })

  const items = Array.from(mostRecent.values()).sort((a, b) => {
    if (a.entry.date !== b.entry.date) return a.entry.date < b.entry.date ? 1 : -1
    return b.index - a.index
  })

  return items.slice(0, limit).map(({ entry }) => toSavedMealItem(entry))
}

/**
 * Dedupe entries by lowercase name, sorted by occurrence count descending
 * (min count 2 to qualify). Macros come from the most recent occurrence.
 */
export function frequentFoods(entries: FoodEntry[], limit = 12): SavedMealItem[] {
  const counts = new Map<string, number>()
  const mostRecent = new Map<string, { entry: FoodEntry; index: number }>()

  entries.forEach((entry, index) => {
    const key = entry.name.trim().toLowerCase()
    counts.set(key, (counts.get(key) ?? 0) + 1)
    const existing = mostRecent.get(key)
    if (!existing || isMoreRecent(entry, index, existing.entry, existing.index)) {
      mostRecent.set(key, { entry, index })
    }
  })

  const qualifying = Array.from(counts.entries())
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])

  return qualifying.slice(0, limit).map(([key]) => {
    const recent = mostRecent.get(key)
    return toSavedMealItem(recent!.entry)
  })
}

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { uid } from '../lib/id'
import type { CustomFood, FoodEntry } from '../types'

type NutritionState = {
  entries: FoodEntry[]
  customFoods: CustomFood[]
  addEntry: (entry: Omit<FoodEntry, 'id'>) => void
  updateEntry: (id: string, patch: Partial<FoodEntry>) => void
  removeEntry: (id: string) => void
  addCustomFood: (food: Omit<CustomFood, 'id'>) => void
}

export const useNutritionStore = create<NutritionState>()(
  persist(
    (set, get) => ({
      entries: [],
      customFoods: [],
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
    }),
    { name: 'fm-nutrition' },
  ),
)

export function entriesForDate(entries: FoodEntry[], date: string): FoodEntry[] {
  return entries.filter((e) => e.date === date)
}

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { BodyEntry } from '../types'

type BodyState = {
  entries: BodyEntry[]
  upsertEntry: (entry: BodyEntry) => void
  removeEntry: (date: string) => void
}

export const useBodyStore = create<BodyState>()(
  persist(
    (set, get) => ({
      entries: [],
      upsertEntry: (entry) => {
        const rest = get().entries.filter((e) => e.date !== entry.date)
        set({ entries: [...rest, entry] })
      },
      removeEntry: (date) => {
        set({ entries: get().entries.filter((e) => e.date !== date) })
      },
    }),
    { name: 'fm-body' },
  ),
)

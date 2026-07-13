import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { BodyEntry, MeasurementEntry } from '../types'

type BodyState = {
  entries: BodyEntry[]
  measurements: MeasurementEntry[]
  upsertEntry: (entry: BodyEntry) => void
  removeEntry: (date: string) => void
  /** Merge measurement values into the entry for `date` (values override same keys). */
  upsertMeasurement: (date: string, values: Record<string, number>) => void
  removeMeasurement: (date: string) => void
}

export const useBodyStore = create<BodyState>()(
  persist(
    (set, get) => ({
      entries: [],
      measurements: [],
      upsertEntry: (entry) => {
        const rest = get().entries.filter((e) => e.date !== entry.date)
        set({ entries: [...rest, entry] })
      },
      removeEntry: (date) => {
        set({ entries: get().entries.filter((e) => e.date !== date) })
      },
      upsertMeasurement: (date, values) => {
        const existing = get().measurements.find((m) => m.date === date)
        const rest = get().measurements.filter((m) => m.date !== date)
        const merged: MeasurementEntry = {
          date,
          values: { ...(existing?.values ?? {}), ...values },
        }
        set({ measurements: [...rest, merged] })
      },
      removeMeasurement: (date) => {
        set({ measurements: get().measurements.filter((m) => m.date !== date) })
      },
    }),
    { name: 'fm-body' },
  ),
)

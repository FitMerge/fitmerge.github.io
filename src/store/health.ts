import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { HealthDay } from '../types'

type HealthState = {
  /** dateISO -> daily wellness metrics. */
  days: Record<string, HealthDay>
  upsertDay: (day: HealthDay) => void
  removeDay: (date: string) => void
}

export const useHealthStore = create<HealthState>()(
  persist(
    (set, get) => ({
      days: {},
      upsertDay: (day) => {
        // Merge metric bags for that date (a partial import shouldn't wipe metrics
        // it didn't include).
        const existing = get().days[day.date]
        const metrics = { ...(existing?.metrics ?? {}), ...day.metrics }
        set({ days: { ...get().days, [day.date]: { date: day.date, metrics } } })
      },
      removeDay: (date) => {
        const days = { ...get().days }
        delete days[date]
        set({ days })
      },
    }),
    { name: 'fm-health' },
  ),
)

/** Health days as a newest-first array. */
export function healthDaysDesc(days: Record<string, HealthDay>): HealthDay[] {
  return Object.values(days).sort((a, b) => (a.date < b.date ? 1 : -1))
}

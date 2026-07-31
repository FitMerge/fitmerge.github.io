import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { BodyEntry, MeasurementEntry } from '../types'

type BodyState = {
  entries: BodyEntry[]
  measurements: MeasurementEntry[]
  /**
   * dateISO → epoch ms when the weigh-in for that date was deleted.
   *
   * This is what makes deleting a weigh-in survive a sync. The merge unions
   * entries by date, so a deletion — mere absence — looked identical to a date
   * the other device had never seen, and the entry came straight back on the
   * next reconcile. The tombstone records the deletion as an event with a
   * time, letting the merge compare "deleted at T1" against "written at T2"
   * and keep whichever happened last. Cleared when a new weigh-in is logged
   * for that date. Same idea as `logAt` in the supplements store.
   */
  removedAt: Record<string, number>
  upsertEntry: (entry: BodyEntry) => void
  /** Upsert many weigh-ins in a single persisted write (bulk import). */
  bulkUpsertEntries: (entries: BodyEntry[]) => void
  removeEntry: (date: string) => void
  /** Merge measurement values into the entry for `date` (values override same keys). */
  upsertMeasurement: (date: string, values: Record<string, number>) => void
  removeMeasurement: (date: string) => void
}

/** Drop tombstones for the given dates — logging a weigh-in supersedes an old deletion. */
function clearRemoved(removedAt: Record<string, number>, dates: string[]): Record<string, number> {
  const next = { ...removedAt }
  for (const d of dates) delete next[d]
  return next
}

export const useBodyStore = create<BodyState>()(
  persist(
    (set, get) => ({
      entries: [],
      measurements: [],
      removedAt: {},
      upsertEntry: (entry) => {
        const rest = get().entries.filter((e) => e.date !== entry.date)
        set({
          entries: [...rest, { ...entry, at: Date.now() }],
          removedAt: clearRemoved(get().removedAt, [entry.date]),
        })
      },
      bulkUpsertEntries: (incoming) => {
        const now = Date.now()
        const byDate = new Map(get().entries.map((e) => [e.date, e]))
        for (const e of incoming) byDate.set(e.date, { ...e, at: now })
        set({
          entries: Array.from(byDate.values()),
          removedAt: clearRemoved(get().removedAt, incoming.map((e) => e.date)),
        })
      },
      removeEntry: (date) => {
        set({
          entries: get().entries.filter((e) => e.date !== date),
          removedAt: { ...get().removedAt, [date]: Date.now() },
        })
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

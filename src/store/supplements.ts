// Daily supplements / habits — a user-defined list of things to take or do each
// day (creatine, vitamin D, fish oil, a glass of greens, …) plus a per-day log of
// how much was taken. Deliberately generic so "any other daily goal" needs no new
// code: a habit with no dose is just a checkbox (targetAmount / unit omitted), a
// dosed supplement tracks an amount toward a target.
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { uid } from '../lib/id'

/** A metric a goal can auto-track from, instead of being a manual check-off. */
export type GoalMetric = 'weighin' | 'sleepScore' | 'sleepMinutes' | 'protein' | 'steps'

/** When present, the goal ticks itself on any day the metric meets `target`
 * (weigh-in needs no target — just that one was logged). */
export type GoalLink = { metric: GoalMetric; target?: number }

export type Supplement = {
  id: string
  name: string
  /** Dose unit, e.g. 'g', 'mg', 'IU', 'capsule'. Omit for a plain check-off habit. */
  unit?: string
  /** Daily target amount; drives the default dose and the "done" threshold. */
  targetAmount?: number
  /** Auto-track this goal from a real metric rather than a manual tap. */
  link?: GoalLink
}

type SupplementState = {
  items: Supplement[]
  /** dateISO → supplementId → amount taken that day (1 for a checked habit). */
  log: Record<string, Record<string, number>>
  addItem: (item: Omit<Supplement, 'id'>) => string
  updateItem: (id: string, patch: Partial<Omit<Supplement, 'id'>>) => void
  removeItem: (id: string) => void
  /** Set the amount taken for a day (absolute); 0 clears the entry. */
  setDose: (date: string, id: string, amount: number) => void
  /** Add to the amount taken. Defaults to the item's target, else 1. */
  addDose: (date: string, id: string, amount?: number) => void
  /** Toggle a day's entry between "done" (target/1) and cleared. */
  toggle: (date: string, id: string) => void
}

function writeDose(log: SupplementState['log'], date: string, id: string, amount: number): SupplementState['log'] {
  const day = { ...(log[date] ?? {}) }
  if (amount > 0) day[id] = amount
  else delete day[id]
  const next = { ...log, [date]: day }
  if (Object.keys(day).length === 0) delete next[date]
  return next
}

export const useSupplementStore = create<SupplementState>()(
  persist(
    (set, get) => ({
      items: [],
      log: {},
      addItem: (item) => {
        const id = uid()
        set({ items: [...get().items, { ...item, id }] })
        return id
      },
      updateItem: (id, patch) =>
        set({ items: get().items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }),
      removeItem: (id) => {
        // Drop the item and any of its logged doses.
        const log: SupplementState['log'] = {}
        for (const [date, day] of Object.entries(get().log)) {
          const { [id]: _drop, ...rest } = day
          if (Object.keys(rest).length) log[date] = rest
        }
        set({ items: get().items.filter((i) => i.id !== id), log })
      },
      setDose: (date, id, amount) => set({ log: writeDose(get().log, date, id, amount) }),
      addDose: (date, id, amount) => {
        const item = get().items.find((i) => i.id === id)
        const step = amount ?? item?.targetAmount ?? 1
        const current = get().log[date]?.[id] ?? 0
        set({ log: writeDose(get().log, date, id, current + step) })
      },
      toggle: (date, id) => {
        const item = get().items.find((i) => i.id === id)
        const done = (get().log[date]?.[id] ?? 0) > 0
        set({ log: writeDose(get().log, date, id, done ? 0 : item?.targetAmount ?? 1) })
      },
    }),
    { name: 'fm-supplements' },
  ),
)

/** How much of `id` was taken on `date` (0 if none). */
export function doseFor(log: SupplementState['log'], date: string, id: string): number {
  return log[date]?.[id] ?? 0
}

/**
 * Consecutive days (ending today, or yesterday when today isn't finished yet)
 * on which EVERY current goal was completed — the "Day N" counter for
 * challenge-style checklists like 75 Hard.
 */
export function fullCompletionStreak(items: Supplement[], log: SupplementState['log'], today: string): number {
  if (items.length === 0) return 0
  const allDone = (date: string) => items.every((i) => doseFor(log, date, i.id) > 0)
  const dayBefore = (date: string) => {
    const [y, m, d] = date.split('-').map(Number)
    const dt = new Date(y, (m ?? 1) - 1, (d ?? 1) - 1)
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
  }
  let streak = 0
  let cursor = allDone(today) ? today : dayBefore(today)
  while (allDone(cursor)) {
    streak++
    cursor = dayBefore(cursor)
  }
  return streak
}

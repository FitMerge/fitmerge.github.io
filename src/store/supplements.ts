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
  /** dateISO → supplementId → true when the user deliberately unchecked a goal.
   * Without this an auto-linked goal re-ticks itself the moment any watched data
   * changes, so unchecking it is impossible. Cleared when they check it again. */
  manualClears: Record<string, Record<string, true>>
  /**
   * dateISO → supplementId → epoch ms when that checkbox last changed.
   *
   * This is what makes unchecking survive a sync. Merging two devices by union
   * can only ever ADD entries, so a cleared checkbox looked identical to one
   * that had never been touched, and the other device put it straight back.
   * With a timestamp per cell the merge can tell "removed just now" from "never
   * set", and the most recent change wins in either direction.
   *
   * Kept even when the dose is cleared — the stamp IS the record of the
   * removal, so it must outlive the value. Absent means "written before this
   * existed", which the merge treats as the old union behaviour so no history
   * is lost.
   */
  logAt: Record<string, Record<string, number>>
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

/** Record when a checkbox changed. Never pruned — see `logAt` above. */
function stamp(logAt: SupplementState['logAt'], date: string, id: string): SupplementState['logAt'] {
  return { ...logAt, [date]: { ...(logAt[date] ?? {}), [id]: Date.now() } }
}

export const useSupplementStore = create<SupplementState>()(
  persist(
    (set, get) => ({
      items: [],
      log: {},
      manualClears: {},
      logAt: {},
      addItem: (item) => {
        const id = uid()
        set({ items: [...get().items, { ...item, id }] })
        return id
      },
      updateItem: (id, patch) =>
        set({ items: get().items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }),
      removeItem: (id) => {
        // Drop the item and any of its logged doses. Each dropped day is
        // stamped so the removal travels to other devices instead of being
        // unioned straight back.
        const log: SupplementState['log'] = {}
        let logAt = get().logAt
        for (const [date, day] of Object.entries(get().log)) {
          const { [id]: dropped, ...rest } = day
          if (dropped !== undefined) logAt = stamp(logAt, date, id)
          if (Object.keys(rest).length) log[date] = rest
        }
        set({ items: get().items.filter((i) => i.id !== id), log, logAt })
      },
      setDose: (date, id, amount) =>
        set({ log: writeDose(get().log, date, id, amount), logAt: stamp(get().logAt, date, id) }),
      addDose: (date, id, amount) => {
        const item = get().items.find((i) => i.id === id)
        const step = amount ?? item?.targetAmount ?? 1
        const current = get().log[date]?.[id] ?? 0
        set({
          log: writeDose(get().log, date, id, current + step),
          logAt: stamp(get().logAt, date, id),
        })
      },
      toggle: (date, id) => {
        const item = get().items.find((i) => i.id === id)
        const done = (get().log[date]?.[id] ?? 0) > 0
        // Remember a deliberate uncheck so the auto-checker leaves it alone;
        // checking it again (by hand) lifts that block.
        const day = { ...(get().manualClears[date] ?? {}) }
        if (done) day[id] = true
        else delete day[id]
        const manualClears = { ...get().manualClears, [date]: day }
        if (Object.keys(day).length === 0) delete manualClears[date]
        set({
          log: writeDose(get().log, date, id, done ? 0 : item?.targetAmount ?? 1),
          manualClears,
          // Stamped on both paths: unchecking is the case the timestamp exists
          // for, and checking must be able to win over another device's stale
          // uncheck just as readily.
          logAt: stamp(get().logAt, date, id),
        })
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

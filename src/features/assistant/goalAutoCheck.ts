// Auto-check daily goals from real data. Two ways a goal binds to data:
//   • name-based rules for the 75 Hard preset (workout1/2, gallon of water), and
//   • a structured `link` on the goal (weigh-in, sleep score/time, protein, steps).
// Runs over the last week so the challenge Day counter stays honest even when data
// arrives late (e.g. an evening Garmin pull). Auto-checks only ever ADD a check —
// nothing is ever un-checked automatically.

import { useEffect } from 'react'
import { doseFor, useSupplementStore, type GoalMetric } from '../../store/supplements'
import { useWorkoutsStore } from '../../store/workouts'
import { useNutritionStore, entriesForDate } from '../../store/nutrition'
import { useHealthStore } from '../../store/health'
import { useBodyStore } from '../../store/body'
import { sumMacros } from '../../lib/macros'
import { addDays, todayISO } from '../../lib/date'
import type { WorkoutSession } from '../../types'

const GALLON_ML = 3785 // 128 fl oz
const MIN_WORKOUT_MIN = 40 // a "45-min workout" with a little grace
const LOOKBACK_DAYS = 7

export type GoalRule = 'workout1' | 'workout2' | 'water'

/** Which name-based auto-check rule a goal binds to, if any (so the 75 Hard preset
 * and hand-typed variants both match). Structured links are handled separately. */
export function goalRuleFor(name: string): GoalRule | null {
  const n = name.toLowerCase()
  if (n.includes('workout 1')) return 'workout1'
  if (n.includes('workout 2')) return 'workout2'
  if (n.includes('gallon')) return 'water'
  return null
}

type MetricDef = {
  /** Short noun for UI, e.g. "sleep score". */
  label: string
  /** Where the number comes from, shown in the link prompt. */
  source: string
  /** Name fragments that suggest this metric when a goal is typed. */
  keywords: string[]
  needsTarget: boolean
  defaultTarget?: number
  targetSuffix?: string
}

export const GOAL_METRICS: Record<GoalMetric, MetricDef> = {
  weighin: {
    label: 'a weigh-in',
    source: 'your weight log — manual or from Garmin',
    keywords: ['weigh', 'weight', 'scale'],
    needsTarget: false,
  },
  sleepScore: {
    label: 'sleep score',
    source: 'your sleep score',
    keywords: ['sleep score'],
    needsTarget: true,
    defaultTarget: 85,
  },
  sleepMinutes: {
    label: 'sleep time',
    source: 'your sleep time',
    keywords: ['sleep', 'asleep', 'hours in bed'],
    needsTarget: true,
    defaultTarget: 480,
    targetSuffix: 'min',
  },
  protein: {
    label: 'protein',
    source: 'the protein you log',
    keywords: ['protein'],
    needsTarget: true,
    defaultTarget: 150,
    targetSuffix: 'g',
  },
  steps: {
    label: 'steps',
    source: 'your step count',
    keywords: ['step'],
    needsTarget: true,
    defaultTarget: 10000,
    targetSuffix: 'steps',
  },
}

// Detection order matters: "sleep score" must win over the looser "sleep".
const DETECT_ORDER: GoalMetric[] = ['weighin', 'sleepScore', 'sleepMinutes', 'protein', 'steps']

// Words that mean the goal is about a *thing*, not the metric — "Protein powder"
// is a supplement to tick off, not a macro target, and offering to auto-complete
// it from the food diary would check it on days it was never taken.
const NOT_A_METRIC = /\b(powder|shake|bar|scoop|supplement|vest|class|machine|mill|sugar|snack)\b/

/** The metric a freshly-typed goal name looks like it wants, if any. */
export function suggestMetric(name: string): GoalMetric | null {
  const n = name.toLowerCase()
  if (NOT_A_METRIC.test(n)) return null
  for (const m of DETECT_ORDER) {
    // Word-boundary match so "weighted pull-ups" doesn't read as a weigh-in.
    if (GOAL_METRICS[m].keywords.some((k) => new RegExp(`\\b${k}`).test(n))) return m
  }
  return null
}

function sessionMinutes(s: WorkoutSession): number {
  if (typeof s.durationMin === 'number' && s.durationMin > 0) return s.durationMin
  if (s.finishedAt) return (s.finishedAt - s.startedAt) / 60000
  return 0
}

/**
 * Mount once (AppShell): watches every data source a goal can bind to and writes
 * any newly-earned checks into the goal log. Idempotent — a goal already checked
 * (auto or by hand) is left alone, so no write loops.
 */
export function useGoalAutoCheck(): void {
  const items = useSupplementStore((s) => s.items)
  const sessions = useWorkoutsStore((s) => s.sessions)
  const water = useNutritionStore((s) => s.water)
  const entries = useNutritionStore((s) => s.entries)
  const healthDays = useHealthStore((s) => s.days)
  const bodyEntries = useBodyStore((s) => s.entries)

  useEffect(() => {
    const ruled = items.filter((i) => i.link != null || goalRuleFor(i.name) !== null)
    if (ruled.length === 0) return
    const { log, setDose, manualClears } = useSupplementStore.getState()
    const today = todayISO()
    const weighDates = new Set(bodyEntries.map((e) => e.date))

    for (let back = 0; back < LOOKBACK_DAYS; back++) {
      const date = addDays(today, -back)
      const metrics = healthDays[date]?.metrics ?? {}
      const qualifying = sessions.filter(
        (s) => s.date === date && (s.finishedAt !== undefined || s.imported) && sessionMinutes(s) >= MIN_WORKOUT_MIN,
      ).length
      let dayProtein = -1 // computed on demand — only if a protein goal exists

      for (const item of ruled) {
        if (doseFor(log, date, item.id) > 0) continue
        // The user unchecked this on purpose — don't tick it straight back on.
        if (manualClears[date]?.[item.id]) continue

        let met = false
        if (item.link) {
          const { metric, target } = item.link
          if (metric === 'weighin') {
            met = weighDates.has(date)
          } else if (metric === 'protein') {
            if (dayProtein < 0) dayProtein = sumMacros(entriesForDate(entries, date)).protein
            met = dayProtein >= (target ?? GOAL_METRICS.protein.defaultTarget ?? 150)
          } else {
            const key = metric === 'sleepScore' ? 'sleepScore' : metric === 'sleepMinutes' ? 'sleepMinutes' : 'steps'
            const value = metrics[key]
            met = typeof value === 'number' && value >= (target ?? GOAL_METRICS[metric].defaultTarget ?? 0)
          }
        } else {
          const rule = goalRuleFor(item.name)
          met =
            rule === 'workout1'
              ? qualifying >= 1
              : rule === 'workout2'
                ? qualifying >= 2
                : (water[date] ?? 0) >= GALLON_ML
        }

        if (met) setDose(date, item.id, item.targetAmount ?? 1)
      }
    }
  }, [items, sessions, water, entries, healthDays, bodyEntries])
}

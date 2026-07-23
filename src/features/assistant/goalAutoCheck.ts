// Auto-check daily goals from real data: workout goals tick themselves when a
// qualifying session is logged (manual or Garmin-imported), and the
// gallon-of-water goal ticks when the day's water log crosses a gallon. Runs
// over the last week so the challenge Day counter stays honest even when data
// arrives late (e.g. an evening Garmin pull). Auto-checks only ever ADD a
// check — nothing is ever un-checked automatically.

import { useEffect } from 'react'
import { doseFor, useSupplementStore } from '../../store/supplements'
import { useWorkoutsStore } from '../../store/workouts'
import { useNutritionStore } from '../../store/nutrition'
import { addDays, todayISO } from '../../lib/date'
import type { WorkoutSession } from '../../types'

const GALLON_ML = 3785 // 128 fl oz
const MIN_WORKOUT_MIN = 40 // a "45-min workout" with a little grace
const LOOKBACK_DAYS = 7

export type GoalRule = 'workout1' | 'workout2' | 'water'

/** Which auto-check rule a goal's name binds it to, if any (name-based so the
 * 75 Hard preset and hand-typed variants both match). */
export function goalRuleFor(name: string): GoalRule | null {
  const n = name.toLowerCase()
  if (n.includes('workout 1')) return 'workout1'
  if (n.includes('workout 2')) return 'workout2'
  if (n.includes('gallon')) return 'water'
  return null
}

function sessionMinutes(s: WorkoutSession): number {
  if (typeof s.durationMin === 'number' && s.durationMin > 0) return s.durationMin
  if (s.finishedAt) return (s.finishedAt - s.startedAt) / 60000
  return 0
}

/**
 * Mount once (AppShell): watches sessions, water and the goal list, and writes
 * any newly-earned checks into the goal log. Idempotent — a goal already
 * checked (auto or by hand) is left alone, so no write loops.
 */
export function useGoalAutoCheck(): void {
  const items = useSupplementStore((s) => s.items)
  const sessions = useWorkoutsStore((s) => s.sessions)
  const water = useNutritionStore((s) => s.water)

  useEffect(() => {
    const ruled = items.filter((i) => goalRuleFor(i.name) !== null)
    if (ruled.length === 0) return
    const { log, setDose } = useSupplementStore.getState()
    const today = todayISO()
    for (let back = 0; back < LOOKBACK_DAYS; back++) {
      const date = addDays(today, -back)
      const qualifying = sessions.filter(
        (s) => s.date === date && (s.finishedAt !== undefined || s.imported) && sessionMinutes(s) >= MIN_WORKOUT_MIN,
      ).length
      for (const item of ruled) {
        if (doseFor(log, date, item.id) > 0) continue
        const rule = goalRuleFor(item.name)
        const met =
          rule === 'workout1'
            ? qualifying >= 1
            : rule === 'workout2'
              ? qualifying >= 2
              : (water[date] ?? 0) >= GALLON_ML
        if (met) setDose(date, item.id, item.targetAmount ?? 1)
      }
    }
  }, [items, sessions, water])
}

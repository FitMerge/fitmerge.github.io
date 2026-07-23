// One hook that assembles every cross-page stat the home screen shows, so the
// home layout components stay pure presentation. Pulls from all five stores and
// reuses the same selectors/trend math the deep-dive pages use, keeping numbers
// consistent between the home tiles and the pages they link to.

import { useMemo } from 'react'
import { useNutritionStore, entriesForDate } from '../../store/nutrition'
import { useSettingsStore } from '../../store/settings'
import { useBodyStore } from '../../store/body'
import { useWorkoutsStore } from '../../store/workouts'
import { healthDaysDesc, useHealthStore } from '../../store/health'
import { doseFor, useSupplementStore, type Supplement } from '../../store/supplements'
import { addDays, todayISO, weekdayIndex } from '../../lib/date'
import { sumMacros } from '../../lib/macros'
import { burnedCaloriesForDate, latestBodyWeightKg } from '../../lib/exercise'
import { totalVolume } from '../workouts/utils'
import { weightStats, type WeightStats } from '../progress/weightTrends'
import { ACTIVITY_GOALS, heroScore, latestMetric, metricSpark, todayHighlights, type Highlight, type HeroPick } from '../health/healthToday'
import type { Goals, HealthDay, Routine, Units, WorkoutSession } from '../../types'

export type WeekTraining = {
  /** Finished sessions in the last 7 days (imported cardio included). */
  sessions: number
  /** Working volume (display-unit lbs/kgs as stored) lifted in the last 7 days. */
  volume: number
  /** Volume in the 7 days before that, for a vs-last-week read. */
  prevVolume: number
  /** Last finished session, newest first. */
  last: WorkoutSession | null
  /** Per-week working volume for the last 8 weeks, oldest→newest (sparkline). */
  weeklyVolumes: number[]
}

export type HomeData = {
  today: string
  units: Units
  goals: Goals
  // Nutrition
  foodCalories: number
  burned: number
  remaining: number
  protein: number
  carbs: number
  fat: number
  mealsLogged: number
  waterMl: number
  waterGoalMl: number
  streak: number
  // Health
  hero: HeroPick | null
  highlights: Highlight[]
  heroSpark: number[]
  steps: number | null
  stepsGoal: number
  sleepMinutes: number | null
  sleepScore: number | null
  healthDesc: HealthDay[]
  // Body
  weight: WeightStats | null
  weightSpark: number[]
  // Training
  todaysRoutine: Routine | null
  activeSessionId: string | undefined
  trainedToday: boolean
  week: WeekTraining
  // Supplements
  supplements: Supplement[]
  supplementsTaken: number
}

function isFinished(s: WorkoutSession): boolean {
  return Boolean(s.finishedAt) || Boolean(s.imported)
}

export function useHomeData(): HomeData {
  const entries = useNutritionStore((s) => s.entries)
  const exerciseByDate = useNutritionStore((s) => s.exercise)
  const goals = useSettingsStore((s) => s.goals)
  const units = useSettingsStore((s) => s.units)
  const waterGoalMl = useSettingsStore((s) => s.waterGoalMl)
  const bodyEntries = useBodyStore((s) => s.entries)
  const routines = useWorkoutsStore((s) => s.routines)
  const sessions = useWorkoutsStore((s) => s.sessions)
  const activeSessionId = useWorkoutsStore((s) => s.activeSessionId)
  const healthDays = useHealthStore((s) => s.days)
  const supplements = useSupplementStore((s) => s.items)
  const supplementLog = useSupplementStore((s) => s.log)

  const today = todayISO()
  const waterMl = useNutritionStore((s) => s.water[today] ?? 0)

  const todayEntries = useMemo(() => entriesForDate(entries, today), [entries, today])
  const totals = useMemo(() => sumMacros(todayEntries), [todayEntries])
  const burned = useMemo(
    () => burnedCaloriesForDate(today, exerciseByDate, sessions, latestBodyWeightKg(bodyEntries)),
    [today, exerciseByDate, sessions, bodyEntries],
  )

  const streak = useMemo(() => {
    let count = 0
    let cursor = today
    while (entriesForDate(entries, cursor).length > 0) {
      count += 1
      cursor = addDays(cursor, -1)
    }
    return count
  }, [entries, today])

  const healthDesc = useMemo(() => healthDaysDesc(healthDays), [healthDays])
  const hero = useMemo(() => heroScore(healthDesc), [healthDesc])
  const heroSpark = useMemo(() => (hero ? metricSpark(healthDesc, hero.key, 14) : []), [healthDesc, hero])
  const highlights = useMemo(() => todayHighlights(healthDesc), [healthDesc])
  const stepsM = useMemo(() => latestMetric(healthDesc, 'steps'), [healthDesc])
  const sleepM = useMemo(() => latestMetric(healthDesc, 'sleepMinutes'), [healthDesc])
  const sleepScoreM = useMemo(() => latestMetric(healthDesc, 'sleepScore'), [healthDesc])

  const weight = useMemo(() => weightStats(bodyEntries, '90d', units), [bodyEntries, units])
  const weightSpark = useMemo(() => {
    const sorted = [...bodyEntries].sort((a, b) => (a.date < b.date ? -1 : 1))
    return sorted.slice(-14).map((e) => e.weightKg)
  }, [bodyEntries])

  const todaysRoutine = useMemo(() => {
    const weekday = weekdayIndex(today)
    return routines.find((r) => r.scheduleDays?.includes(weekday)) ?? null
  }, [routines, today])

  const trainedToday = useMemo(
    () => sessions.some((s) => s.date === today && isFinished(s) && !s.imported),
    [sessions, today],
  )

  const week = useMemo<WeekTraining>(() => {
    const weekStart = addDays(today, -6)
    const prevStart = addDays(today, -13)
    const finished = sessions.filter(isFinished)
    const inWeek = finished.filter((s) => s.date >= weekStart)
    const inPrev = finished.filter((s) => s.date >= prevStart && s.date < weekStart)
    const last = [...finished].sort((a, b) => (a.date < b.date ? 1 : -1))[0] ?? null
    const weeklyVolumes: number[] = []
    for (let w = 7; w >= 0; w--) {
      const start = addDays(today, -(w * 7 + 6))
      const end = addDays(today, -(w * 7))
      weeklyVolumes.push(
        finished
          .filter((s) => s.date >= start && s.date <= end)
          .reduce((sum, s) => sum + totalVolume(s), 0),
      )
    }
    return {
      sessions: inWeek.length,
      volume: inWeek.reduce((sum, s) => sum + totalVolume(s), 0),
      prevVolume: inPrev.reduce((sum, s) => sum + totalVolume(s), 0),
      last,
      weeklyVolumes,
    }
  }, [sessions, today])

  const supplementsTaken = useMemo(
    () => supplements.filter((i) => doseFor(supplementLog, today, i.id) > 0).length,
    [supplements, supplementLog, today],
  )

  return {
    today,
    units,
    goals,
    foodCalories: totals.calories,
    burned,
    remaining: Math.round(goals.calories - totals.calories + burned),
    protein: totals.protein,
    carbs: totals.carbs,
    fat: totals.fat,
    mealsLogged: todayEntries.length,
    waterMl,
    waterGoalMl,
    streak,
    hero,
    highlights,
    heroSpark,
    steps: stepsM && stepsM.date === today ? stepsM.value : stepsM ? stepsM.value : null,
    stepsGoal: ACTIVITY_GOALS.steps,
    sleepMinutes: sleepM?.value ?? null,
    sleepScore: sleepScoreM?.value ?? null,
    healthDesc,
    weight,
    weightSpark,
    todaysRoutine,
    activeSessionId,
    trainedToday,
    week,
    supplements,
    supplementsTaken,
  }
}

// Assembles a compact, serialisable summary of the user's recent training,
// nutrition, recovery and goals for the AI coach. Pure + input-driven (no store
// hooks) so it's easy to unit-test; the UI gathers store state via getState()
// and hands it in. Everything here reuses the same helpers the deep-dive pages
// use, so the coach sees the same numbers the user sees.

import type {
  BodyEntry,
  ExerciseEntry,
  FoodEntry,
  Goals,
  HealthDay,
  Profile,
  Routine,
  Units,
  WorkoutSession,
} from '../../types'
import type { CoachProfile } from '../../store/settings'
import type { Supplement } from '../../store/supplements'
import { addDays, lastNDays, todayISO, weekdayIndex } from '../../lib/date'
import { sumMacros } from '../../lib/macros'
import { entriesForDate } from '../../store/nutrition'
import { doseFor } from '../../store/supplements'
import { burnedCaloriesForDate, latestBodyWeightKg } from '../../lib/exercise'
import { kgToLb } from '../../lib/units'
import { isWorkingSet, totalVolume } from '../../features/workouts/utils'
import { isCardioSession } from '../../features/workouts/cardio'
import { weightStats } from '../../features/progress/weightTrends'
import { performanceManagementChart, acwr, formState } from '../../lib/trainingLoad'
import { coachSignals } from '../../lib/coachSignals'
import { EXERCISES, getExerciseById } from '../../data/exercises'
import { hasEquipment } from '../../data/equipment'

const HEALTH_KEYS = ['sleepMinutes', 'hrv', 'restingHr', 'steps', 'bodyBattery', 'trainingReadiness', 'stress'] as const

export type CoachDay = {
  date: string
  calories: number
  protein: number
  carbs: number
  fat: number
  waterMl: number
  burned: number
  trained: string | null // 'strength' | 'cardio' | 'strength+cardio' | null
  health: Partial<Record<(typeof HEALTH_KEYS)[number], number>>
  goalsMet: number // supplements/daily goals completed
  goalsTotal: number
}

export type CoachExercise = { id: string; name: string; muscleGroup: string; equipment: string }

export type CoachContext = {
  today: string
  units: Units
  goals: Goals
  profile: Profile
  coachProfile?: CoachProfile
  goalWeightDisplay: number | null
  days: CoachDay[]
  training: {
    sessionsThisWeek: number
    volumeThisWeek: number
    volumePrevWeek: number
    strengthPerWeek: number
    cardioPerWeek: number
    form: { ctl: number; atl: number; tsb: number; label: string } | null
    acwr: { ratio: number; level: string; label: string } | null
  }
  weight: { latest: number; trend: number; ratePerWeek: number; toGoal: number | null } | null
  recovery: { level: string; title: string; detail: string }[]
  todaysRoutine: { name: string; exercises: string[] } | null
  trainedToday: boolean
  equipment: string[] | 'all'
  /** Exercises the user can do with their equipment — the coach must pick from these ids. */
  library: CoachExercise[]
}

export type CoachInputs = {
  units: Units
  goals: Goals
  profile: Profile
  coachProfile?: CoachProfile
  goalWeightKg?: number
  entries: FoodEntry[]
  water: Record<string, number>
  exerciseByDate: Record<string, ExerciseEntry[]>
  sessions: WorkoutSession[]
  healthDays: Record<string, HealthDay>
  bodyEntries: BodyEntry[]
  supplements: Supplement[]
  supplementLog: Parameters<typeof doseFor>[0]
  routines: Routine[]
  availableEquipment?: string[]
}

function isFinished(s: WorkoutSession): boolean {
  return Boolean(s.finishedAt) || Boolean(s.imported)
}

function trainedKind(sessions: WorkoutSession[], date: string): string | null {
  let strength = false
  let cardio = false
  for (const s of sessions) {
    if (s.date !== date || !isFinished(s)) continue
    if (isCardioSession(s)) cardio = true
    else if (s.entries.some((e) => e.sets.some(isWorkingSet))) strength = true
  }
  if (strength && cardio) return 'strength+cardio'
  if (strength) return 'strength'
  if (cardio) return 'cardio'
  return null
}

export function buildCoachContext(input: CoachInputs): CoachContext {
  const today = todayISO()
  const bodyWeightKg = latestBodyWeightKg(input.bodyEntries)

  const days: CoachDay[] = lastNDays(5).map((date) => {
    const totals = sumMacros(entriesForDate(input.entries, date))
    const health: CoachDay['health'] = {}
    const hd = input.healthDays[date]
    if (hd) for (const k of HEALTH_KEYS) if (typeof hd.metrics[k] === 'number') health[k] = Math.round(hd.metrics[k])
    return {
      date,
      calories: Math.round(totals.calories),
      protein: Math.round(totals.protein),
      carbs: Math.round(totals.carbs),
      fat: Math.round(totals.fat),
      waterMl: Math.round(input.water[date] ?? 0),
      burned: Math.round(burnedCaloriesForDate(date, input.exerciseByDate, input.sessions, bodyWeightKg)),
      trained: trainedKind(input.sessions, date),
      health,
      goalsMet: input.supplements.filter((s) => doseFor(input.supplementLog, date, s.id) > 0).length,
      goalsTotal: input.supplements.length,
    }
  })

  // Weekly strength volume, this week vs last.
  const finished = input.sessions.filter(isFinished)
  const weekStart = addDays(today, -6)
  const prevStart = addDays(today, -13)
  const volumeThisWeek = finished.filter((s) => s.date >= weekStart).reduce((sum, s) => sum + totalVolume(s), 0)
  const volumePrevWeek = finished
    .filter((s) => s.date >= prevStart && s.date < weekStart)
    .reduce((sum, s) => sum + totalVolume(s), 0)
  const sessionsThisWeek = finished.filter((s) => s.date >= weekStart).length

  // 28-day training frequency (matches FitnessTipsSection).
  const monthStart = addDays(today, -27)
  const last28 = input.sessions.filter((s) => isFinished(s) && s.date >= monthStart)
  const strengthPerWeek = last28.filter((s) => !isCardioSession(s) && s.entries.some((e) => e.sets.length > 0)).length / 4
  const cardioPerWeek = last28.filter((s) => isCardioSession(s) || s.entries.length === 0).length / 4

  const pmc = performanceManagementChart(input.sessions)
  const last = pmc[pmc.length - 1]
  const form = last
    ? { ctl: Math.round(last.ctl), atl: Math.round(last.atl), tsb: Math.round(last.tsb), label: formState(last.tsb).label }
    : null
  const ac = acwr(input.sessions)

  const goalWeightDisplay =
    input.goalWeightKg != null ? (input.units === 'imperial' ? kgToLb(input.goalWeightKg) : input.goalWeightKg) : null
  const ws = weightStats(input.bodyEntries, '90d', input.units, goalWeightDisplay ?? undefined)

  const weekday = weekdayIndex(today)
  const todaysRoutine = input.routines.find((r) => r.scheduleDays?.includes(weekday)) ?? null
  const trainedToday = trainedKind(input.sessions, today) === 'strength' || trainedKind(input.sessions, today) === 'strength+cardio'

  const library: CoachExercise[] = EXERCISES.filter((e) => hasEquipment(e.equipment, input.availableEquipment)).map(
    (e) => ({ id: e.id, name: e.name, muscleGroup: e.muscleGroup, equipment: e.equipment }),
  )

  return {
    today,
    units: input.units,
    goals: input.goals,
    profile: input.profile,
    coachProfile: input.coachProfile,
    goalWeightDisplay: goalWeightDisplay != null ? Math.round(goalWeightDisplay * 10) / 10 : null,
    days,
    training: {
      sessionsThisWeek,
      volumeThisWeek: Math.round(volumeThisWeek),
      volumePrevWeek: Math.round(volumePrevWeek),
      strengthPerWeek: Math.round(strengthPerWeek * 10) / 10,
      cardioPerWeek: Math.round(cardioPerWeek * 10) / 10,
      form,
      acwr: ac ? { ratio: Math.round(ac.ratio * 100) / 100, level: ac.level, label: ac.label } : null,
    },
    weight: ws
      ? {
          latest: Math.round(ws.latest * 10) / 10,
          trend: Math.round(ws.trend * 10) / 10,
          ratePerWeek: Math.round(ws.ratePerWeek * 100) / 100,
          toGoal: ws.toGoal != null ? Math.round(ws.toGoal * 10) / 10 : null,
        }
      : null,
    recovery: coachSignals(input.healthDays).map((s) => ({ level: s.level, title: s.title, detail: s.detail })),
    todaysRoutine: todaysRoutine
      ? { name: todaysRoutine.name, exercises: todaysRoutine.items.map((i) => getExerciseById(i.exerciseId)?.name ?? i.exerciseId) }
      : null,
    trainedToday,
    equipment: input.availableEquipment && input.availableEquipment.length > 0 ? input.availableEquipment : 'all',
    library,
  }
}

// Parse and restore a FitMerge backup produced by Settings → Export data.
// Restore MERGES into whatever is already on the device (union by id / date, so
// importing a backup never destroys newer local logs), mirroring how sync merges.

import { useNutritionStore } from '../store/nutrition'
import { useWorkoutsStore } from '../store/workouts'
import { useBodyStore } from '../store/body'
import { useHealthStore } from '../store/health'
import { useSettingsStore } from '../store/settings'
import type {
  BodyEntry,
  CustomFood,
  ExerciseEntry,
  FoodEntry,
  Goals,
  HealthDay,
  Profile,
  Routine,
  SavedMeal,
  Units,
  WorkoutSession,
} from '../types'

export type BackupSummary = {
  foods: number
  workouts: number
  weighIns: number
}

export type ParsedBackup = {
  raw: BackupData
  summary: BackupSummary
}

type BackupData = {
  nutrition?: {
    entries?: FoodEntry[]
    customFoods?: CustomFood[]
    savedMeals?: SavedMeal[]
    water?: Record<string, number>
    exercise?: Record<string, ExerciseEntry[]>
  }
  workouts?: { routines?: Routine[]; sessions?: WorkoutSession[] }
  body?: { entries?: BodyEntry[] }
  health?: { days?: Record<string, HealthDay> }
  settings?: { goals?: Goals; units?: Units; profile?: Profile; waterGoalMl?: number }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}
function arr<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : []
}

/** Validate + summarize a pasted/loaded backup. Returns null if it isn't one. */
export function parseBackup(text: string): ParsedBackup | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return null
  }
  if (!isRecord(parsed)) return null

  const nutrition = isRecord(parsed.nutrition) ? parsed.nutrition : undefined
  const workouts = isRecord(parsed.workouts) ? parsed.workouts : undefined
  const body = isRecord(parsed.body) ? parsed.body : undefined
  const health = isRecord(parsed.health) ? parsed.health : undefined
  const settings = isRecord(parsed.settings) ? parsed.settings : undefined

  // Must look like a FitMerge backup: at least one recognized section.
  if (!nutrition && !workouts && !body && !health) return null

  const raw: BackupData = {
    nutrition: nutrition && {
      entries: arr<FoodEntry>(nutrition.entries),
      customFoods: arr<CustomFood>(nutrition.customFoods),
      savedMeals: arr<SavedMeal>(nutrition.savedMeals),
      water: isRecord(nutrition.water) ? (nutrition.water as Record<string, number>) : {},
      exercise: isRecord(nutrition.exercise)
        ? (nutrition.exercise as Record<string, ExerciseEntry[]>)
        : {},
    },
    workouts: workouts && {
      routines: arr<Routine>(workouts.routines),
      sessions: arr<WorkoutSession>(workouts.sessions),
    },
    body: body && { entries: arr<BodyEntry>(body.entries) },
    health: health && {
      days: isRecord(health.days) ? (health.days as Record<string, HealthDay>) : {},
    },
    settings: settings as BackupData['settings'],
  }

  const summary: BackupSummary = {
    foods: raw.nutrition?.entries?.length ?? 0,
    workouts: raw.workouts?.sessions?.length ?? 0,
    weighIns: raw.body?.entries?.length ?? 0,
  }
  return { raw, summary }
}

function unionBy<T>(current: T[], incoming: T[], key: (i: T) => string): T[] {
  const map = new Map<string, T>()
  for (const i of current) map.set(key(i), i)
  for (const i of incoming) map.set(key(i), i) // incoming (backup) wins ties
  return Array.from(map.values())
}

/** Merge a parsed backup into the live stores. */
export function applyBackup(data: BackupData): void {
  if (data.nutrition) {
    const s = useNutritionStore.getState()
    const water: Record<string, number> = { ...s.water }
    for (const [d, ml] of Object.entries(data.nutrition.water ?? {})) {
      water[d] = Math.max(ml, water[d] ?? 0)
    }
    const exercise: Record<string, ExerciseEntry[]> = { ...s.exercise }
    for (const [d, list] of Object.entries(data.nutrition.exercise ?? {})) {
      exercise[d] = unionBy(exercise[d] ?? [], list ?? [], (e) => e.id)
    }
    useNutritionStore.setState({
      entries: unionBy(s.entries, data.nutrition.entries ?? [], (e) => e.id),
      customFoods: unionBy(s.customFoods, data.nutrition.customFoods ?? [], (f) => f.id),
      savedMeals: unionBy(s.savedMeals, data.nutrition.savedMeals ?? [], (m) => m.id),
      water,
      exercise,
    })
  }
  if (data.health) {
    const s = useHealthStore.getState()
    const days: Record<string, HealthDay> = { ...s.days }
    for (const [d, day] of Object.entries(data.health.days ?? {})) {
      days[d] = { date: d, metrics: { ...(days[d]?.metrics ?? {}), ...(day?.metrics ?? {}) } }
    }
    useHealthStore.setState({ days })
  }
  if (data.workouts) {
    const s = useWorkoutsStore.getState()
    useWorkoutsStore.setState({
      routines: unionBy(s.routines, data.workouts.routines ?? [], (r) => r.id),
      sessions: unionBy(s.sessions, data.workouts.sessions ?? [], (x) => x.id),
    })
  }
  if (data.body) {
    const s = useBodyStore.getState()
    useBodyStore.setState({
      entries: unionBy(s.entries, data.body.entries ?? [], (e) => e.date),
    })
  }
  if (data.settings) {
    const patch: Record<string, unknown> = {}
    const { goals, units, profile, waterGoalMl } = data.settings
    if (goals) patch.goals = goals
    if (units) patch.units = units
    if (profile) patch.profile = profile
    if (typeof waterGoalMl === 'number') patch.waterGoalMl = waterGoalMl
    if (Object.keys(patch).length) useSettingsStore.setState(patch)
  }
}

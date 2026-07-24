// Per-store adapters bridging the Zustand stores to the sync layer. Each adapter
// knows how to read the store's synced fields, apply a snapshot back, subscribe
// to local changes, and — the critical part — MERGE a local snapshot with a
// cloud one without losing records.
//
// Merge is used only on first sign-in (mode 'merge'); after that the newest full
// snapshot wins per store. Merging by stable id/date is what prevents data loss
// when a device that already has data joins an account.

import { useNutritionStore } from '../../store/nutrition'
import { useWorkoutsStore } from '../../store/workouts'
import { useBodyStore } from '../../store/body'
import { useHealthStore } from '../../store/health'
import { useSettingsStore } from '../../store/settings'
import type {
  BodyEntry,
  CustomFood,
  ExerciseEntry,
  FoodEntry,
  Goals,
  HealthDay,
  MeasurementEntry,
  Profile,
  Program,
  Routine,
  SavedMeal,
  Units,
  WorkoutSession,
} from '../../types'
import type { StoreData, StoreName } from './backend'

export type StoreAdapter = {
  name: StoreName
  read(): StoreData
  apply(data: StoreData): void
  subscribe(cb: () => void): () => void
  /** Combine a local snapshot with a cloud one (cloud may be null → local wins). */
  merge(local: StoreData, cloud: StoreData | null): StoreData
}

// --- helpers ---------------------------------------------------------------

/** Union two lists by a stable key; on collision the LOCAL item wins (the
 * device being merged in keeps its most recent edit). Cloud-only items are kept. */
function unionBy<T>(local: T[], cloud: T[], key: (item: T) => string): T[] {
  const byKey = new Map<string, T>()
  for (const item of cloud) byKey.set(key(item), item)
  for (const item of local) byKey.set(key(item), item)
  return Array.from(byKey.values())
}

function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : []
}

function asRecord(v: unknown): Record<string, number> {
  return v && typeof v === 'object' ? (v as Record<string, number>) : {}
}

function asHealthDays(v: unknown): Record<string, HealthDay> {
  if (!v || typeof v !== 'object') return {}
  const out: Record<string, HealthDay> = {}
  for (const [date, day] of Object.entries(v as Record<string, unknown>)) {
    if (day && typeof day === 'object' && typeof (day as HealthDay).metrics === 'object') {
      out[date] = { date, metrics: (day as HealthDay).metrics }
    }
  }
  return out
}

function asExerciseMap(v: unknown): Record<string, ExerciseEntry[]> {
  if (!v || typeof v !== 'object') return {}
  const out: Record<string, ExerciseEntry[]> = {}
  for (const [date, list] of Object.entries(v as Record<string, unknown>)) {
    if (Array.isArray(list)) out[date] = list as ExerciseEntry[]
  }
  return out
}

// --- nutrition -------------------------------------------------------------

const nutrition: StoreAdapter = {
  name: 'nutrition',
  read() {
    const s = useNutritionStore.getState()
    return {
      entries: s.entries,
      customFoods: s.customFoods,
      savedMeals: s.savedMeals,
      water: s.water,
      exercise: s.exercise,
    }
  },
  apply(data) {
    useNutritionStore.setState({
      entries: asArray<FoodEntry>(data.entries),
      customFoods: asArray<CustomFood>(data.customFoods),
      savedMeals: asArray<SavedMeal>(data.savedMeals),
      water: asRecord(data.water),
      exercise: asExerciseMap(data.exercise),
    })
  },
  subscribe(cb) {
    return useNutritionStore.subscribe(cb)
  },
  merge(local, cloud) {
    if (!cloud) return local
    // water: union of dates, keeping the larger intake per day (avoids double count).
    const water: Record<string, number> = { ...asRecord(cloud.water) }
    for (const [date, ml] of Object.entries(asRecord(local.water))) {
      water[date] = Math.max(ml, water[date] ?? 0)
    }
    // exercise: union of dates; within a date, union entries by id.
    const exercise: Record<string, ExerciseEntry[]> = {}
    const lx = asExerciseMap(local.exercise)
    const cx = asExerciseMap(cloud.exercise)
    for (const date of new Set([...Object.keys(lx), ...Object.keys(cx)])) {
      exercise[date] = unionBy(lx[date] ?? [], cx[date] ?? [], (e) => e.id)
    }
    return {
      entries: unionBy(asArray<FoodEntry>(local.entries), asArray<FoodEntry>(cloud.entries), (e) => e.id),
      customFoods: unionBy(asArray<CustomFood>(local.customFoods), asArray<CustomFood>(cloud.customFoods), (f) => f.id),
      savedMeals: unionBy(asArray<SavedMeal>(local.savedMeals), asArray<SavedMeal>(cloud.savedMeals), (m) => m.id),
      water,
      exercise,
    }
  },
}

// --- workouts --------------------------------------------------------------
// activeSessionId is intentionally NOT synced: an in-progress session is local
// to the device you're training on.

const workouts: StoreAdapter = {
  name: 'workouts',
  read() {
    const s = useWorkoutsStore.getState()
    return { routines: s.routines, sessions: s.sessions, programs: s.programs }
  },
  apply(data) {
    useWorkoutsStore.setState({
      routines: asArray<Routine>(data.routines),
      sessions: asArray<WorkoutSession>(data.sessions),
      programs: asArray<Program>(data.programs),
    })
  },
  subscribe(cb) {
    return useWorkoutsStore.subscribe(cb)
  },
  merge(local, cloud) {
    if (!cloud) return local
    return {
      routines: unionBy(asArray<Routine>(local.routines), asArray<Routine>(cloud.routines), (r) => r.id),
      sessions: unionBy(asArray<WorkoutSession>(local.sessions), asArray<WorkoutSession>(cloud.sessions), (s) => s.id),
      programs: unionBy(asArray<Program>(local.programs), asArray<Program>(cloud.programs), (p) => p.id),
    }
  },
}

// --- body ------------------------------------------------------------------

const body: StoreAdapter = {
  name: 'body',
  read() {
    const s = useBodyStore.getState()
    return { entries: s.entries, measurements: s.measurements }
  },
  apply(data) {
    useBodyStore.setState({
      entries: asArray<BodyEntry>(data.entries),
      measurements: asArray<MeasurementEntry>(data.measurements),
    })
  },
  subscribe(cb) {
    return useBodyStore.subscribe(cb)
  },
  merge(local, cloud) {
    if (!cloud) return local
    // One weigh-in / measurement set per date; local wins a same-date conflict.
    return {
      entries: unionBy(asArray<BodyEntry>(local.entries), asArray<BodyEntry>(cloud.entries), (e) => e.date),
      measurements: unionBy(
        asArray<MeasurementEntry>(local.measurements),
        asArray<MeasurementEntry>(cloud.measurements),
        (e) => e.date,
      ),
    }
  },
}

// --- health ----------------------------------------------------------------

const health: StoreAdapter = {
  name: 'health',
  read() {
    return { days: useHealthStore.getState().days }
  },
  apply(data) {
    // Union incoming days with what's already local — never a hard replace. Health
    // history can be large (years of daily Garmin metrics) and may exceed
    // Firestore's 1MB per-doc limit, so its cloud upload can silently fail and the
    // realtime listener then delivers an EMPTY doc. A replace here would wipe the
    // local history on every load; a merge keeps it (and still folds in any genuine
    // remote additions).
    const incoming = asHealthDays(data.days)
    const current = useHealthStore.getState().days
    const merged: Record<string, HealthDay> = { ...current }
    for (const date of Object.keys(incoming)) {
      merged[date] = { date, metrics: { ...(current[date]?.metrics ?? {}), ...incoming[date].metrics } }
    }
    useHealthStore.setState({ days: merged })
  },
  subscribe(cb) {
    return useHealthStore.subscribe(cb)
  },
  merge(local, cloud) {
    if (!cloud) return local
    // Union by date; within a date, merge metric bags (local wins per-metric).
    const ld = asHealthDays(local.days)
    const cd = asHealthDays(cloud.days)
    const days: Record<string, HealthDay> = {}
    for (const date of new Set([...Object.keys(ld), ...Object.keys(cd)])) {
      days[date] = { date, metrics: { ...(cd[date]?.metrics ?? {}), ...(ld[date]?.metrics ?? {}) } }
    }
    return { days }
  },
}

// --- settings --------------------------------------------------------------
// Singleton values (not collections). The API keys sync too so a new device
// gets them after sign-in instead of re-typing — but they're guarded below so
// an empty cloud value never wipes a real local key. On merge, cloud values win
// so a freshly-installed device doesn't clobber the account's goals with defaults.

// Credential-style fields (the user's own keys, GitHub token, and repo): carry
// them across devices but treat an empty value as "no update" so one device
// signing in blank can't erase them. They live only in the user's own per-user
// Firestore doc, readable solely by their authenticated uid.
const KEY_FIELDS = ['geminiApiKey', 'usdaApiKey', 'githubToken', 'githubRepo'] as const

const settings: StoreAdapter = {
  name: 'settings',
  read() {
    const s = useSettingsStore.getState()
    return {
      goals: s.goals,
      units: s.units,
      profile: s.profile,
      waterGoalMl: s.waterGoalMl,
      onboarded: s.onboarded,
      geminiApiKey: s.geminiApiKey,
      usdaApiKey: s.usdaApiKey,
      githubToken: s.githubToken,
      githubRepo: s.githubRepo,
      availableEquipment: s.availableEquipment,
      restTimerSound: s.restTimerSound,
      coachProfile: s.coachProfile,
    }
  },
  apply(data) {
    useSettingsStore.setState((prev) => ({
      goals: (data.goals as Goals | undefined) ?? prev.goals,
      units: (data.units as Units | undefined) ?? prev.units,
      profile: (data.profile as Profile | undefined) ?? prev.profile,
      waterGoalMl: (data.waterGoalMl as number | undefined) ?? prev.waterGoalMl,
      onboarded: (data.onboarded as boolean | undefined) ?? prev.onboarded,
      availableEquipment: (data.availableEquipment as string[] | undefined) ?? prev.availableEquipment,
      restTimerSound: (data.restTimerSound as boolean | undefined) ?? prev.restTimerSound,
      coachProfile: (data.coachProfile as typeof prev.coachProfile) ?? prev.coachProfile,
      // `||` (not `??`) so an empty incoming value keeps the existing local one.
      geminiApiKey: (data.geminiApiKey as string | undefined) || prev.geminiApiKey,
      usdaApiKey: (data.usdaApiKey as string | undefined) || prev.usdaApiKey,
      githubToken: (data.githubToken as string | undefined) || prev.githubToken,
      githubRepo: (data.githubRepo as string | undefined) || prev.githubRepo,
    }))
  },
  subscribe(cb) {
    return useSettingsStore.subscribe(cb)
  },
  merge(local, cloud) {
    if (!cloud) return local
    const merged = { ...local, ...cloud }
    for (const k of KEY_FIELDS) {
      if (!cloud[k] && local[k]) merged[k] = local[k]
    }
    return merged
  },
}

export const STORE_ADAPTERS: StoreAdapter[] = [nutrition, workouts, body, settings, health]

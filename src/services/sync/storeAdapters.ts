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
import { useSettingsStore } from '../../store/settings'
import type {
  BodyEntry,
  CustomFood,
  FoodEntry,
  Goals,
  Profile,
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

// --- nutrition -------------------------------------------------------------

const nutrition: StoreAdapter = {
  name: 'nutrition',
  read() {
    const s = useNutritionStore.getState()
    return { entries: s.entries, customFoods: s.customFoods, savedMeals: s.savedMeals, water: s.water }
  },
  apply(data) {
    useNutritionStore.setState({
      entries: asArray<FoodEntry>(data.entries),
      customFoods: asArray<CustomFood>(data.customFoods),
      savedMeals: asArray<SavedMeal>(data.savedMeals),
      water: asRecord(data.water),
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
    return {
      entries: unionBy(asArray<FoodEntry>(local.entries), asArray<FoodEntry>(cloud.entries), (e) => e.id),
      customFoods: unionBy(asArray<CustomFood>(local.customFoods), asArray<CustomFood>(cloud.customFoods), (f) => f.id),
      savedMeals: unionBy(asArray<SavedMeal>(local.savedMeals), asArray<SavedMeal>(cloud.savedMeals), (m) => m.id),
      water,
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
    return { routines: s.routines, sessions: s.sessions }
  },
  apply(data) {
    useWorkoutsStore.setState({
      routines: asArray<Routine>(data.routines),
      sessions: asArray<WorkoutSession>(data.sessions),
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
    }
  },
}

// --- body ------------------------------------------------------------------

const body: StoreAdapter = {
  name: 'body',
  read() {
    return { entries: useBodyStore.getState().entries }
  },
  apply(data) {
    useBodyStore.setState({ entries: asArray<BodyEntry>(data.entries) })
  },
  subscribe(cb) {
    return useBodyStore.subscribe(cb)
  },
  merge(local, cloud) {
    if (!cloud) return local
    // One weigh-in per date; local wins a same-date conflict.
    return {
      entries: unionBy(asArray<BodyEntry>(local.entries), asArray<BodyEntry>(cloud.entries), (e) => e.date),
    }
  },
}

// --- settings --------------------------------------------------------------
// Singleton values (not collections). geminiApiKey is device-local and never
// read/applied here, so it survives untouched. On merge, cloud values win so a
// freshly-installed device doesn't clobber the account's goals with defaults.

const settings: StoreAdapter = {
  name: 'settings',
  read() {
    const s = useSettingsStore.getState()
    return { goals: s.goals, units: s.units, profile: s.profile, waterGoalMl: s.waterGoalMl, onboarded: s.onboarded }
  },
  apply(data) {
    useSettingsStore.setState((prev) => ({
      goals: (data.goals as Goals | undefined) ?? prev.goals,
      units: (data.units as Units | undefined) ?? prev.units,
      profile: (data.profile as Profile | undefined) ?? prev.profile,
      waterGoalMl: (data.waterGoalMl as number | undefined) ?? prev.waterGoalMl,
      onboarded: (data.onboarded as boolean | undefined) ?? prev.onboarded,
    }))
  },
  subscribe(cb) {
    return useSettingsStore.subscribe(cb)
  },
  merge(local, cloud) {
    if (!cloud) return local
    return { ...local, ...cloud }
  },
}

export const STORE_ADAPTERS: StoreAdapter[] = [nutrition, workouts, body, settings]

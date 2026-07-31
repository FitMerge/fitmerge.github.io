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
import { useSupplementStore, type Supplement } from '../../store/supplements'
import { useChallengeStore, type JoinedChallenge } from '../../store/challenges'
import type {
  BodyEntry,
  CustomFood,
  ExerciseEntry,
  FoodEntry,
  GarminRecord,
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

/** First list that has anything in it. For data a single authority recomputes
 * wholesale, where merging two copies would be meaningless. */
function pickNonEmpty<T>(preferred: T[], fallback: T[]): T[] {
  return preferred.length > 0 ? preferred : fallback
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

function asDayMap<V>(v: unknown): Record<string, Record<string, V>> {
  if (!v || typeof v !== 'object') return {}
  const out: Record<string, Record<string, V>> = {}
  for (const [date, day] of Object.entries(v as Record<string, unknown>)) {
    if (day && typeof day === 'object') out[date] = day as Record<string, V>
  }
  return out
}

type DoseMap = Record<string, Record<string, number>>
type ClearMap = Record<string, Record<string, true>>

export type SupplementLog = { log: DoseMap; manualClears: ClearMap; logAt: DoseMap }

function put<V>(into: Record<string, Record<string, V>>, date: string, id: string, value: V): void {
  const day = into[date] ?? (into[date] = {})
  day[id] = value
}

/**
 * Merge two copies of the daily checklist, one checkbox at a time.
 *
 * A plain union was the obvious approach and it was wrong: it can only ever ADD
 * entries, so a checkbox cleared on your phone looked exactly like one your
 * laptop had never touched, and the laptop put it straight back. Unchecking a
 * habit simply would not stick — and a resurrected tick silently inflates a
 * challenge score, which is the number everybody else sees.
 *
 * So each cell carries the moment it last changed and the newer side wins,
 * whether that change was a tick or a clear. Ties go to local, matching
 * `unionBy` elsewhere in this file.
 *
 * Cells with no timestamp on EITHER side predate this and fall back to the old
 * union, so nothing already recorded is lost by the upgrade.
 */
export function mergeSupplementLog(local: SupplementLog, cloud: SupplementLog): SupplementLog {
  const log: DoseMap = {}
  const manualClears: ClearMap = {}
  const logAt: DoseMap = {}

  const dates = new Set([
    ...Object.keys(local.log),
    ...Object.keys(cloud.log),
    ...Object.keys(local.manualClears),
    ...Object.keys(cloud.manualClears),
    ...Object.keys(local.logAt),
    ...Object.keys(cloud.logAt),
  ])

  for (const date of dates) {
    const ids = new Set([
      ...Object.keys(local.log[date] ?? {}),
      ...Object.keys(cloud.log[date] ?? {}),
      ...Object.keys(local.manualClears[date] ?? {}),
      ...Object.keys(cloud.manualClears[date] ?? {}),
      ...Object.keys(local.logAt[date] ?? {}),
      ...Object.keys(cloud.logAt[date] ?? {}),
    ])

    for (const id of ids) {
      const localAt = local.logAt[date]?.[id] ?? 0
      const cloudAt = cloud.logAt[date]?.[id] ?? 0

      if (localAt === 0 && cloudAt === 0) {
        // Legacy cell: no side can say when it changed, so keep whatever exists.
        const dose = local.log[date]?.[id] ?? cloud.log[date]?.[id]
        if (dose !== undefined) put(log, date, id, dose)
        if (local.manualClears[date]?.[id] || cloud.manualClears[date]?.[id]) {
          put(manualClears, date, id, true)
        }
        continue
      }

      const winner = localAt >= cloudAt ? local : cloud
      const dose = winner.log[date]?.[id]
      // An absent dose on the winning side is a deliberate clear, and must stay
      // absent — that is the whole point of the timestamp.
      if (dose !== undefined) put(log, date, id, dose)
      if (winner.manualClears[date]?.[id]) put(manualClears, date, id, true)
      put(logAt, date, id, Math.max(localAt, cloudAt))
    }
  }

  return { log, manualClears, logAt }
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
    // garminRecords must be read back out as well as applied: the sync job writes
    // them into this same document, and a read that omitted them would drop them
    // on the app's next upload.
    return {
      routines: s.routines,
      sessions: s.sessions,
      programs: s.programs,
      garminRecords: s.garminRecords,
    }
  },
  apply(data) {
    useWorkoutsStore.setState({
      routines: asArray<Routine>(data.routines),
      sessions: asArray<WorkoutSession>(data.sessions),
      programs: asArray<Program>(data.programs),
      garminRecords: asArray<GarminRecord>(data.garminRecords),
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
      // Records are Garmin's to compute, not ours to reconcile: take whichever
      // side actually has them rather than unioning two versions of the same PR.
      garminRecords: pickNonEmpty(
        asArray<GarminRecord>(cloud.garminRecords),
        asArray<GarminRecord>(local.garminRecords),
      ),
    }
  },
}

// --- body ------------------------------------------------------------------

export type BodySnapshot = { entries: BodyEntry[]; removedAt: Record<string, number> }

function asRemovedAt(v: unknown): Record<string, number> {
  return v && typeof v === 'object' ? (v as Record<string, number>) : {}
}

/**
 * Merge two copies of the weigh-in history, one date at a time.
 *
 * The old union-by-date could only ever ADD, so a deleted weigh-in was
 * indistinguishable from one the other side had never seen and every reconcile
 * resurrected it. Now each entry carries `at` (when it was written) and the
 * store keeps `removedAt` tombstones (when a date was deleted); whichever
 * happened last wins.
 *
 * Dates with no timestamp on EITHER side predate this and fall back to the old
 * union (local wins a conflict), so nothing already recorded is lost. An entry
 * with no `at` facing a tombstone loses — deleting in the app beats a row the
 * Garmin job re-imports for the same date, which is what you want when the
 * Garmin data was the mistake.
 */
export function mergeBodyEntries(local: BodySnapshot, cloud: BodySnapshot): BodySnapshot {
  const localBy = new Map(local.entries.map((e) => [e.date, e]))
  const cloudBy = new Map(cloud.entries.map((e) => [e.date, e]))
  const dates = new Set([
    ...localBy.keys(),
    ...cloudBy.keys(),
    ...Object.keys(local.removedAt),
    ...Object.keys(cloud.removedAt),
  ])

  const entries: BodyEntry[] = []
  const removedAt: Record<string, number> = {}

  for (const date of dates) {
    const le = localBy.get(date)
    const ce = cloudBy.get(date)
    const lRemoved = local.removedAt[date] ?? 0
    const cRemoved = cloud.removedAt[date] ?? 0
    const lAt = Math.max(le?.at ?? 0, lRemoved)
    const cAt = Math.max(ce?.at ?? 0, cRemoved)

    if (lAt === 0 && cAt === 0) {
      // Legacy date: no side can say when it changed, keep whatever exists.
      const e = le ?? ce
      if (e) entries.push(e)
      continue
    }

    // A side "has" the entry only when the write is at least as new as its own
    // tombstone — a stamped tombstone beats an unstamped (imported) row.
    const winnerEntry = lAt >= cAt ? le : ce
    const winnerRemoved = lAt >= cAt ? lRemoved : cRemoved
    const newest = Math.max(lAt, cAt)
    if (winnerEntry && (winnerEntry.at ?? 0) >= winnerRemoved) {
      // Stamp with the newest time seen so repeated merges stay stable.
      entries.push({ ...winnerEntry, at: newest })
    } else {
      removedAt[date] = newest
    }
  }

  return { entries, removedAt }
}

const body: StoreAdapter = {
  name: 'body',
  read() {
    const s = useBodyStore.getState()
    return { entries: s.entries, measurements: s.measurements, removedAt: s.removedAt }
  },
  apply(data) {
    useBodyStore.setState({
      entries: asArray<BodyEntry>(data.entries),
      measurements: asArray<MeasurementEntry>(data.measurements),
      removedAt: asRemovedAt(data.removedAt),
    })
  },
  subscribe(cb) {
    return useBodyStore.subscribe(cb)
  },
  merge(local, cloud) {
    if (!cloud) return local
    const merged = mergeBodyEntries(
      { entries: asArray<BodyEntry>(local.entries), removedAt: asRemovedAt(local.removedAt) },
      { entries: asArray<BodyEntry>(cloud.entries), removedAt: asRemovedAt(cloud.removedAt) },
    )
    return {
      entries: merged.entries,
      // Measurements still union by date (local wins a conflict) — deleting one
      // can resurrect from another device. Same fix applies if it ever matters.
      measurements: unionBy(
        asArray<MeasurementEntry>(local.measurements),
        asArray<MeasurementEntry>(cloud.measurements),
        (e) => e.date,
      ),
      removedAt: merged.removedAt,
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
      trackingSource: s.trackingSource,
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
      trackingSource: (data.trackingSource as typeof prev.trackingSource) ?? prev.trackingSource,
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

// --- supplements -----------------------------------------------------------
// The daily checklist: habits/supplements plus the per-day log of what was
// ticked. This went unsynced for a long time, which meant signing in on a new
// phone restored everything except your habit history. Challenges score off this
// log, so it now has to travel with the account.

const supplements: StoreAdapter = {
  name: 'supplements',
  read() {
    const s = useSupplementStore.getState()
    return { items: s.items, log: s.log, manualClears: s.manualClears, logAt: s.logAt }
  },
  apply(data) {
    useSupplementStore.setState({
      items: asArray<Supplement>(data.items),
      log: asDayMap<number>(data.log),
      manualClears: asDayMap<true>(data.manualClears),
      logAt: asDayMap<number>(data.logAt),
    })
  },
  subscribe(cb) {
    return useSupplementStore.subscribe(cb)
  },
  merge(local, cloud) {
    if (!cloud) return local
    const merged = mergeSupplementLog(
      {
        log: asDayMap<number>(local.log),
        manualClears: asDayMap<true>(local.manualClears),
        logAt: asDayMap<number>(local.logAt),
      },
      {
        log: asDayMap<number>(cloud.log),
        manualClears: asDayMap<true>(cloud.manualClears),
        logAt: asDayMap<number>(cloud.logAt),
      },
    )
    return {
      items: unionBy(asArray<Supplement>(local.items), asArray<Supplement>(cloud.items), (i) => i.id),
      ...merged,
    }
  },
}

// --- challenges ------------------------------------------------------------
// Only the private half: which challenges you're in, the cached definition, and
// your own habit weights. The shared half (members, scores) lives in its own
// Firestore collection and never passes through this layer.

const challenges: StoreAdapter = {
  name: 'challenges',
  read() {
    const s = useChallengeStore.getState()
    return { joined: s.joined, displayName: s.displayName }
  },
  apply(data) {
    useChallengeStore.setState((prev) => ({
      joined: asArray<JoinedChallenge>(data.joined),
      // `||` not `??`: an empty incoming name must not blank out a real one, the
      // same guard the settings credentials use.
      displayName: (data.displayName as string | undefined) || prev.displayName,
    }))
  },
  subscribe(cb) {
    return useChallengeStore.subscribe(cb)
  },
  merge(local, cloud) {
    if (!cloud) return local
    return {
      joined: unionBy(
        asArray<JoinedChallenge>(local.joined),
        asArray<JoinedChallenge>(cloud.joined),
        (j) => j.challenge.code,
      ),
      displayName: (local.displayName as string) || (cloud.displayName as string) || '',
    }
  },
}

export const STORE_ADAPTERS: StoreAdapter[] = [
  nutrition,
  workouts,
  body,
  settings,
  health,
  supplements,
  challenges,
]

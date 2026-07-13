import type { BodyEntry, ExerciseEntry, WorkoutSession } from '../types'

// Moderate resistance-training MET; used to estimate burn from a logged session's
// duration when the source didn't report calories directly.
const STRENGTH_MET = 5
const DEFAULT_BODY_WEIGHT_KG = 75

/** Most recent recorded bodyweight (kg), or a sane default when none logged. */
export function latestBodyWeightKg(entries: BodyEntry[]): number {
  if (entries.length === 0) return DEFAULT_BODY_WEIGHT_KG
  const latest = [...entries].sort((a, b) => (a.date < b.date ? 1 : -1))[0]
  return latest?.weightKg && latest.weightKg > 0 ? latest.weightKg : DEFAULT_BODY_WEIGHT_KG
}

/** Estimated calories burned by a finished workout session — uses a reported kcal
 * (imported sessions) when present, else a MET estimate from its duration. */
export function estimateSessionCalories(session: WorkoutSession, bodyWeightKg: number): number {
  if (!session.finishedAt) return 0
  if (typeof session.kcal === 'number' && session.kcal > 0) return Math.round(session.kcal)
  const durationMin = session.durationMin ?? (session.finishedAt - session.startedAt) / 60000
  if (!(durationMin > 0) || !(bodyWeightKg > 0)) return 0
  return Math.round((STRENGTH_MET * bodyWeightKg * durationMin) / 60)
}

/** Total calories burned on a date: manual exercise entries + finished workouts. */
export function burnedCaloriesForDate(
  date: string,
  exerciseByDate: Record<string, ExerciseEntry[]>,
  sessions: WorkoutSession[],
  bodyWeightKg: number,
): number {
  const manual = (exerciseByDate[date] ?? []).reduce((sum, e) => sum + (e.calories || 0), 0)
  const workouts = sessions
    .filter((s) => s.finishedAt && s.date === date)
    .reduce((sum, s) => sum + estimateSessionCalories(s, bodyWeightKg), 0)
  return Math.round(manual + workouts)
}

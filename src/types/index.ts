// Shared domain types for FitMerge.
// Dates are stored as ISO date strings 'YYYY-MM-DD'.

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export type Macros = {
  calories: number
  protein: number
  carbs: number
  fat: number
}

export type FoodEntry = {
  id: string
  date: string
  mealType: MealType
  name: string
  qty: number
  unit: string
  photoThumbId?: string
  source?: 'manual' | 'photo' | 'search'
  /** Grams. */
  fiber?: number
  /** Grams. */
  sugar?: number
  /** Milligrams. */
  sodium?: number
} & Macros

export type CustomFood = {
  id: string
  name: string
  brand?: string
  serving: string
  per: Macros
}

export type Exercise = {
  id: string
  name: string
  muscleGroup: string
  equipment: string
  instructions?: string
  /** Muscles primarily worked — highlighted strongly on the exercise muscle map. */
  primaryMuscles?: import('../data/muscles').MuscleId[]
  /** Assisting muscles — highlighted faintly on the muscle map. */
  secondaryMuscles?: import('../data/muscles').MuscleId[]
  /** Numbered how-to steps shown on the exercise demonstration sheet. */
  steps?: string[]
}

export type RoutineItem = {
  exerciseId: string
  targetSets: number
  targetReps: number
  restSec: number
  /** Coaching note shown under the exercise while training. */
  note?: string
}

export type Routine = {
  id: string
  name: string
  notes?: string
  items: RoutineItem[]
  scheduleDays?: number[]
}

/** One scheduled session within a multi-week Program (reuses an existing Routine). */
export type ProgramDay = {
  id: string
  week: number
  name: string
  routineId: string
}

/** A multi-week guided training plan — an ordered list of workout days you follow. */
export type Program = {
  id: string
  name: string
  createdAt: number
  days: ProgramDay[]
  /** ids of ProgramDays already completed. */
  completedDayIds: string[]
}

export type SetType = 'warmup' | 'normal' | 'drop'

export type SetLog = {
  reps: number
  weight: number
  done: boolean
  /** Set classification; absent means a normal working set. Warmup/drop sets are
   * excluded from working-volume and personal-record calculations. */
  type?: SetType
}

export type WorkoutSessionEntry = {
  exerciseId: string
  sets: SetLog[]
  /** Free-text note for this exercise within the session (form cues, tweaks). */
  note?: string
}

export type WorkoutSession = {
  id: string
  routineId?: string
  /** Set when this session was started from a Program day, so finishing it marks that day done. */
  programDayId?: string
  name: string
  date: string
  startedAt: number
  finishedAt?: number
  entries: WorkoutSessionEntry[]
  /** True for sessions created via Health Data Connect import (Apple Health, Garmin, FitMerge JSON). */
  imported?: boolean
  /** Minutes — used for imported sessions where entries (and thus timers) are empty. */
  durationMin?: number
  /** Calories burned, when reported by the import source. */
  kcal?: number
  /** Garmin's training-load (TSS-like) value for the activity, when available.
   * Used to calibrate the CTL/ATL/TSB performance-management chart. */
  trainingLoad?: number
  /** Distance covered (kilometres) for cardio activities, when reported — powers
   * pace/distance progression charts. */
  distanceKm?: number
}

export type BodyEntry = {
  date: string
  weightKg: number
  bodyFatPct?: number
  note?: string
}

/**
 * Body-measurement entry — an open-ended bag of circumference/length values keyed
 * by measurement id (see `src/data/measurements.ts`). Lengths are stored in
 * centimetres and converted for display; open-ended so new measures need no schema
 * change, mirroring HealthDay.
 */
export type MeasurementEntry = {
  date: string
  /** measurementId → value in centimetres. */
  values: Record<string, number>
}

export type Units = 'metric' | 'imperial'
export type Sex = 'male' | 'female'
export type Activity = 'sedentary' | 'light' | 'moderate' | 'active' | 'very'

export type Goals = Macros

export type Profile = {
  name?: string
  sex: Sex
  age?: number
  heightCm?: number
  activity: Activity
  goalType?: 'lose' | 'maintain' | 'gain'
}

/**
 * Daily wellness metrics from an import (Garmin, Apple Health, …). Deliberately a
 * flexible bag of named numeric metrics — steps, restingHr, sleepScore, stress,
 * bodyBattery, vo2max, spo2, hrv, floors, intensityMinutes, and anything else the
 * source exposes — so new Garmin metrics need no schema change. Known keys get
 * nice labels/units from the metric catalog; unknown keys still display.
 */
export type HealthDay = {
  date: string
  metrics: Record<string, number>
}

/** A logged exercise / cardio session that burns calories back into the day's budget. */
export type ExerciseEntry = {
  id: string
  name: string
  minutes?: number
  calories: number
}

export type SavedMealItem = {
  name: string
  qty: number
  unit: string
} & Macros

export type SavedMeal = {
  id: string
  name: string
  items: SavedMealItem[]
}

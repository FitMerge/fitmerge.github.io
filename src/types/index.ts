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
}

export type RoutineItem = {
  exerciseId: string
  targetSets: number
  targetReps: number
  restSec: number
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

export type SetLog = {
  reps: number
  weight: number
  done: boolean
}

export type WorkoutSessionEntry = {
  exerciseId: string
  sets: SetLog[]
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
}

export type BodyEntry = {
  date: string
  weightKg: number
  bodyFatPct?: number
  note?: string
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

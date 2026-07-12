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
  name: string
  date: string
  startedAt: number
  finishedAt?: number
  entries: WorkoutSessionEntry[]
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

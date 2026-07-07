import type { Activity, Goals, Profile } from '../types'

const ACTIVITY_MULTIPLIERS: Record<Activity, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very: 1.9,
}

export function bmr(profile: Profile, weightKg: number): number {
  const age = profile.age ?? 30
  const heightCm = profile.heightCm ?? 175
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age
  return profile.sex === 'female' ? base - 161 : base + 5
}

export function tdee(bmrVal: number, activity: Activity): number {
  return bmrVal * ACTIVITY_MULTIPLIERS[activity]
}

export function suggestGoals(
  tdeeVal: number,
  goalType: 'lose' | 'maintain' | 'gain' | undefined,
  weightKg: number,
): Goals {
  const delta = goalType === 'lose' ? -500 : goalType === 'gain' ? 300 : 0
  const calories = Math.round(tdeeVal + delta)

  const protein = Math.round(2 * weightKg)
  const fat = Math.round((calories * 0.25) / 9)
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4))

  return { calories, protein, carbs, fat }
}

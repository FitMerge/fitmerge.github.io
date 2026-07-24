import { describe, expect, it } from 'vitest'
import { bmr, suggestGoals, tdee } from './tdee'
import type { Profile } from '../types'

const profile = (over: Partial<Profile> = {}): Profile => ({
  sex: 'male',
  activity: 'moderate',
  ...over,
})

describe('bmr', () => {
  it('uses the Mifflin-St Jeor male formula (+5)', () => {
    // 10(80) + 6.25(180) - 5(30) + 5
    expect(bmr(profile({ age: 30, heightCm: 180 }), 80)).toBe(1780)
  })

  it('uses the female offset (-161)', () => {
    expect(bmr(profile({ sex: 'female', age: 28, heightCm: 165 }), 65)).toBe(1380.25)
  })

  it('falls back to age 30 / 175cm when the profile is incomplete', () => {
    expect(bmr(profile(), 75)).toBe(bmr(profile({ age: 30, heightCm: 175 }), 75))
    expect(bmr(profile(), 75)).toBe(1698.75)
  })
})

describe('tdee', () => {
  it('scales BMR by the activity multiplier', () => {
    expect(tdee(2000, 'sedentary')).toBeCloseTo(2400, 6)
    expect(tdee(2000, 'light')).toBeCloseTo(2750, 6)
    expect(tdee(2000, 'moderate')).toBeCloseTo(3100, 6)
    expect(tdee(2000, 'active')).toBeCloseTo(3450, 6)
    expect(tdee(2000, 'very')).toBeCloseTo(3800, 6)
  })

  it('is monotonic across activity levels', () => {
    const levels = ['sedentary', 'light', 'moderate', 'active', 'very'] as const
    const values = levels.map((l) => tdee(2000, l))
    expect(values).toEqual([...values].sort((a, b) => a - b))
  })
})

describe('suggestGoals', () => {
  it('applies a 500 kcal deficit when cutting', () => {
    expect(suggestGoals(2000, 'lose', 80).calories).toBe(1500)
  })

  it('applies a 300 kcal surplus when gaining', () => {
    expect(suggestGoals(2000, 'gain', 80).calories).toBe(2300)
  })

  it('leaves calories at maintenance for maintain or an unset goal', () => {
    expect(suggestGoals(2000, 'maintain', 80).calories).toBe(2000)
    expect(suggestGoals(2000, undefined, 80).calories).toBe(2000)
  })

  it('sets protein at 2g/kg and fat at 25% of calories, carbs taking the remainder', () => {
    const goals = suggestGoals(2000, 'lose', 80)
    expect(goals.protein).toBe(160) // 2 x 80kg
    expect(goals.fat).toBe(42) // 1500 x 0.25 / 9
    expect(goals.carbs).toBe(121) // (1500 - 640 - 378) / 4
  })

  it('never returns negative carbs when protein and fat exceed the budget', () => {
    // 100kg cutting on a 1000 kcal maintenance: protein alone overshoots.
    expect(suggestGoals(1000, 'lose', 100).carbs).toBe(0)
  })
})

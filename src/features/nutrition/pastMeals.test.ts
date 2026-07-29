import { describe, expect, it } from 'vitest'
import { mealSummary, pastMeals } from './pastMeals'
import type { FoodEntry, MealType } from '../../types'

let n = 0
function entry(date: string, mealType: MealType, name: string, over: Partial<FoodEntry> = {}): FoodEntry {
  return {
    id: `e${n++}`,
    date,
    mealType,
    name,
    qty: 1,
    unit: 'serving',
    calories: 100,
    protein: 10,
    carbs: 5,
    fat: 2,
    ...over,
  }
}

describe('pastMeals', () => {
  it('keeps a day’s meal together instead of returning loose foods', () => {
    const meals = pastMeals(
      [
        entry('2026-07-27', 'breakfast', 'Eggs'),
        entry('2026-07-27', 'breakfast', 'Ground turkey'),
        entry('2026-07-27', 'breakfast', 'Cottage cheese'),
      ],
      'breakfast',
    )
    expect(meals).toHaveLength(1)
    expect(meals[0].items.map((i) => i.name)).toEqual(['Eggs', 'Ground turkey', 'Cottage cheese'])
  })

  it('totals the meal as it was logged', () => {
    const meals = pastMeals(
      [
        entry('2026-07-27', 'breakfast', 'Eggs', { calories: 210 }),
        entry('2026-07-27', 'breakfast', 'Home fries', { calories: 190 }),
      ],
      'breakfast',
    )
    expect(meals[0].calories).toBe(400)
  })

  it('only offers the meal being logged into', () => {
    const meals = pastMeals(
      [
        entry('2026-07-27', 'breakfast', 'Eggs'),
        entry('2026-07-27', 'dinner', 'Steak'),
      ],
      'breakfast',
    )
    expect(meals.flatMap((m) => m.items.map((i) => i.name))).toEqual(['Eggs'])
  })

  it('lists the most recent day first', () => {
    const meals = pastMeals(
      [
        entry('2026-07-20', 'breakfast', 'Old'),
        entry('2026-07-28', 'breakfast', 'New'),
        entry('2026-07-24', 'breakfast', 'Middle'),
      ],
      'breakfast',
    )
    expect(meals.map((m) => m.date)).toEqual(['2026-07-28', '2026-07-24', '2026-07-20'])
  })

  it('leaves out the day you are logging into', () => {
    // Copying today's breakfast into today's breakfast is never the intent, and it
    // would otherwise sit at the top of the list every single time.
    const meals = pastMeals(
      [
        entry('2026-07-29', 'breakfast', 'Today'),
        entry('2026-07-28', 'breakfast', 'Yesterday'),
      ],
      'breakfast',
      { excludeDate: '2026-07-29' },
    )
    expect(meals.map((m) => m.date)).toEqual(['2026-07-28'])
  })

  it('never shows a day with nothing in that meal', () => {
    const meals = pastMeals([entry('2026-07-28', 'lunch', 'Salad')], 'breakfast')
    expect(meals).toEqual([])
  })

  it('bounds how far back it offers', () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      entry(`2026-06-${String(i + 1).padStart(2, '0')}`, 'breakfast', 'Eggs'),
    )
    expect(pastMeals(many, 'breakfast')).toHaveLength(14)
    expect(pastMeals(many, 'breakfast', { limit: 3 })).toHaveLength(3)
  })

  it('carries the amount actually logged, not a default', () => {
    const meals = pastMeals(
      [entry('2026-07-28', 'breakfast', 'Olive oil', { qty: 2, unit: 'tbsp', calories: 238 })],
      'breakfast',
    )
    expect(meals[0].items[0]).toMatchObject({ qty: 2, unit: 'tbsp', calories: 238 })
  })
})

describe('mealSummary', () => {
  it('names what was on the plate', () => {
    expect(mealSummary([{ name: 'Eggs' }, { name: 'Turkey' }] as never)).toBe('Eggs, Turkey')
  })

  it('truncates a long plate rather than wrapping forever', () => {
    const items = ['Eggs', 'Veggies', 'Turkey', 'Home fries', 'Cottage cheese', 'Salsa'].map(
      (name) => ({ name }),
    ) as never
    expect(mealSummary(items)).toBe('Eggs, Veggies, Turkey, Home fries +2 more')
  })

  it('says so when there is nothing to name', () => {
    expect(mealSummary([])).toBe('Nothing logged')
  })
})

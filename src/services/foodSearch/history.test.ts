import { describe, expect, it } from 'vitest'
import { matchScore, searchHistory, tokenize } from './history'
import type { CustomFood, FoodEntry, SavedMeal } from '../../types'

const entry = (name: string, date: string, calories = 200): FoodEntry =>
  ({ id: name + date, date, mealType: 'snack', name, qty: 1, unit: 'serving',
     calories, protein: 5, carbs: 20, fat: 10 }) as FoodEntry

const sources = (entries: FoodEntry[], savedMeals: SavedMeal[] = [], customFoods: CustomFood[] = []) =>
  ({ entries, savedMeals, customFoods })

describe('tokenize', () => {
  it("joins apostrophes so reese's matches reeses", () => {
    expect(tokenize("Reese's")).toEqual(['reeses'])
    expect(tokenize('reeses')).toEqual(['reeses'])
  })

  it('drops filler words that carry no meaning', () => {
    expect(tokenize('pretzels with peanut butter')).toEqual(['pretzels', 'peanut', 'butter'])
  })
})

describe('matchScore', () => {
  it('matches regardless of word order', () => {
    // The product is "Reese's Filled Peanut Butter Pretzels"; people search
    // "Reese's peanut butter filled pretzels". Same food, different order.
    expect(
      matchScore("Reese's peanut butter filled pretzels", "Reese's Filled Peanut Butter Pretzels"),
    ).toBeGreaterThan(0)
  })

  it('requires every query word to appear', () => {
    // Otherwise searching for the pretzels surfaces plain peanut butter.
    expect(matchScore('peanut butter pretzels', 'Peanut Butter')).toBe(0)
  })

  it('prefers the tighter match', () => {
    const tight = matchScore('peanut butter pretzels', 'Peanut Butter Pretzels')
    const loose = matchScore('peanut butter pretzels', 'Peanut Butter Pretzel Snack Mix With Raisins')
    expect(tight).toBeGreaterThan(loose)
  })

  it('matches on a prefix so it works while still typing', () => {
    expect(matchScore('pretz', 'Peanut Butter Pretzels')).toBeGreaterThan(0)
  })

  it('does not match an unrelated food', () => {
    expect(matchScore('pretzels', 'Greek Yoghurt')).toBe(0)
  })
})

describe('searchHistory', () => {
  it('finds a food you logged before, however you spell it back', () => {
    const s = sources([entry("Reese's Filled Peanut Butter Pretzels", '2026-07-20')])
    const hits = searchHistory('reeses peanut butter pretzels', s)
    expect(hits).toHaveLength(1)
    expect(hits[0].item.name).toBe("Reese's Filled Peanut Butter Pretzels")
  })

  it('returns nothing for an empty query rather than everything', () => {
    expect(searchHistory('  ', sources([entry('Toast', '2026-07-20')]))).toEqual([])
  })

  it('counts repeats and ranks the food you eat most first', () => {
    const s = sources([
      entry('Peanut butter pretzels', '2026-07-01'),
      entry('Peanut butter pretzels', '2026-07-10'),
      entry('Peanut butter pretzel bites', '2026-07-11'),
    ])
    const hits = searchHistory('peanut butter pretzel', s)
    expect(hits[0].item.name).toBe('Peanut butter pretzels')
    expect(hits[0].timesLogged).toBe(2)
  })

  it('shows one row per food, not one per time you ate it', () => {
    const s = sources([
      entry('Toast', '2026-07-01'), entry('Toast', '2026-07-02'), entry('Toast', '2026-07-03'),
    ])
    expect(searchHistory('toast', s)).toHaveLength(1)
  })

  it('remembers the most recent date it was eaten', () => {
    const s = sources([entry('Toast', '2026-07-01'), entry('Toast', '2026-07-09')])
    expect(searchHistory('toast', s)[0].lastDate).toBe('2026-07-09')
  })

  it('includes saved meals and custom foods, tagged by where they came from', () => {
    const s = sources(
      [],
      [{ id: 'm', name: 'Breakfast', items: [{ name: 'Oat pancakes', qty: 1, unit: 'serving', calories: 300, protein: 10, carbs: 40, fat: 8 }] }],
      [{ id: 'c', name: 'Protein shake', brand: 'Optimum', serving: '1 scoop', per: { calories: 120, protein: 24, carbs: 3, fat: 1 } }],
    )
    expect(searchHistory('pancakes', s)[0].reason).toBe('saved')
    const custom = searchHistory('protein shake', s)[0]
    expect(custom.reason).toBe('custom')
    expect(custom.item.name).toBe('Protein shake (Optimum)')
  })

  it('caps how many it offers so it never buries the database results', () => {
    const entries = Array.from({ length: 20 }, (_, i) => entry(`Pretzel variety ${i}`, '2026-07-01'))
    expect(searchHistory('pretzel', sources(entries)).length).toBeLessThanOrEqual(5)
  })
})

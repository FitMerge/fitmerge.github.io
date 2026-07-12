// Local search over the curated COMMON_FOODS database. Instant, offline, and always
// ranked ahead of branded OpenFoodFacts results in the UI — this is what makes
// searching "eggs" return eggs instead of French mayonnaise.

import { COMMON_FOODS } from '../../data/commonFoods'
import type { CommonFood, CommonFoodExtras, CommonFoodMacros } from '../../data/commonFoods'
import type { Extras, SearchFood } from './openFoodFacts'
import type { Macros } from '../../types'

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function scaleMacros(basis: CommonFoodMacros, factor: number): Macros {
  return {
    calories: round1(basis.calories * factor),
    protein: round1(basis.protein * factor),
    carbs: round1(basis.carbs * factor),
    fat: round1(basis.fat * factor),
  }
}

function scaleExtras(basis: CommonFoodExtras | undefined, factor: number): Extras | undefined {
  if (!basis) return undefined
  const extras: Extras = {}
  if (basis.fiber !== undefined) extras.fiber = round1(basis.fiber * factor)
  if (basis.sugar !== undefined) extras.sugar = round1(basis.sugar * factor)
  if (basis.sodiumMg !== undefined) extras.sodiumMg = round1(basis.sodiumMg * factor)
  return extras
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Match strength for a food against a (already trimmed + lowercased) query:
 *   4 = the food name starts with the query
 *   3 = the query matches at a word boundary within the name
 *   2 = an alias starts with, or word-boundary matches, the query
 *   1 = a plain substring match against name, alias, or category
 *   0 = no match
 */
function matchScore(food: CommonFood, query: string): number {
  const name = food.name.toLowerCase()
  const aliases = (food.aliases ?? []).map((a) => a.toLowerCase())
  const category = food.category.toLowerCase()
  const boundary = new RegExp(`\\b${escapeRegExp(query)}`, 'i')

  if (name.startsWith(query)) return 4
  if (boundary.test(name)) return 3
  if (aliases.some((alias) => alias.startsWith(query) || boundary.test(alias))) return 2
  if (name.includes(query) || aliases.some((alias) => alias.includes(query)) || category.includes(query)) return 1
  return 0
}

function toSearchFood(food: CommonFood): SearchFood {
  const factor = food.servingGrams / 100
  return {
    id: `cf-${food.id}`,
    name: food.name,
    brand: undefined,
    servingText: food.servingLabel,
    per100g: food.per100g,
    perServing: scaleMacros(food.per100g, factor),
    extras100g: food.extras100g,
    extrasServing: scaleExtras(food.extras100g, factor),
  }
}

/** Searches the local common-foods database. Synchronous — no network involved. */
export function searchCommonFoods(query: string, limit = 12): SearchFood[] {
  const q = query.trim().toLowerCase()
  if (!q) return []

  const scored = COMMON_FOODS.map((food) => ({ food, score: matchScore(food, q) })).filter((entry) => entry.score > 0)

  scored.sort((a, b) => b.score - a.score)

  return scored.slice(0, limit).map((entry) => toSearchFood(entry.food))
}

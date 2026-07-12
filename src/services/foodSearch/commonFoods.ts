// Local search over the curated COMMON_FOODS database. Instant, offline, and always
// ranked ahead of branded OpenFoodFacts results in the UI — this is what makes
// searching "eggs" return eggs instead of French mayonnaise.

import type { CommonFood, CommonFoodExtras, CommonFoodMacros } from '../../data/commonFoods'
import type { Extras, SearchFood } from './openFoodFacts'
import type { Macros } from '../../types'

// The full ~1500-food database lives in a dynamically-imported chunk so it never
// weighs on app startup; it's fetched the first time the search tab mounts.
let cache: CommonFood[] | null = null
let loading: Promise<void> | null = null

export function commonFoodsReady(): boolean {
  return cache !== null
}

export function loadCommonFoods(): Promise<void> {
  if (cache) return Promise.resolve()
  if (!loading) {
    loading = import('../../data/foods').then((m) => {
      cache = m.ALL_COMMON_FOODS
    })
  }
  return loading
}

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
 *   6 = the food name is exactly the query ("banana" → "Banana")
 *   5 = the query is a whole word within the name ("taco" → "Beef taco")
 *   4 = the name starts with the query as a prefix ("chick" → "Chicken…")
 *   3 = the query matches at a word boundary mid-name (partial word start)
 *   2 = an alias starts with, or word-boundary matches, the query
 *   1 = a plain substring match against name, alias, or category
 *   0 = no match
 * Higher tiers put the canonical, expected food first so searching "taco" leads
 * with tacos (not "Taco salad") and "eggs" with eggs — MyFitnessPal-style relevance.
 */
function matchScore(food: CommonFood, query: string): number {
  const name = food.name.toLowerCase()
  const aliases = (food.aliases ?? []).map((a) => a.toLowerCase())
  const category = food.category.toLowerCase()
  const escaped = escapeRegExp(query)
  const wholeWord = new RegExp(`\\b${escaped}\\b`, 'i')
  const boundary = new RegExp(`\\b${escaped}`, 'i')

  if (name === query) return 6
  if (wholeWord.test(name)) return 5
  if (name.startsWith(query)) return 4
  if (boundary.test(name)) return 3
  if (aliases.some((alias) => alias === query || alias.startsWith(query) || boundary.test(alias))) return 2
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

/** Searches the local common-foods database. Synchronous — no network involved.
 * Returns [] until loadCommonFoods() has resolved (the search tab triggers it on mount). */
export function searchCommonFoods(query: string, limit = 12): SearchFood[] {
  const q = query.trim().toLowerCase()
  if (!q || !cache) return []

  const scored = cache
    .map((food, index) => ({ food, index, score: matchScore(food, q) }))
    .filter((entry) => entry.score > 0)

  // Within a match tier, break ties by original library position. The database is
  // ordered by canonicalness — hand-verified core foods first, single ingredients
  // next, composite/prepared dishes last — so plain "Salmon, cooked" leads over
  // "Salmon jerky", and "Greek yogurt, plain" over "Greek yogurt parfait".
  scored.sort((a, b) => b.score - a.score || a.index - b.index)

  return scored.slice(0, limit).map((entry) => toSearchFood(entry.food))
}

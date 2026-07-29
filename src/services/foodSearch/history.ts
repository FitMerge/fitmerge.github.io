// Search your own food log first.
//
// Everything else in search depends on someone else's server being up: USDA runs
// on a shared demo key capped at ~30 searches an hour, and OpenFoodFacts returns
// 503 a good fraction of the time. When both are having a bad day the search box
// finds nothing — even for a food you have logged a dozen times.
//
// This layer has no network, no rate limit and no failure mode. It also happens
// to be the highest-quality source available: a food you logged before is one you
// already checked, at a portion you already chose. That should outrank a stranger's
// database entry, not be hidden the moment you start typing.

import type { CustomFood, FoodEntry, SavedMeal, SavedMealItem } from '../../types'

export type HistoryMatch = {
  item: SavedMealItem
  /** Higher is better. Only used for ordering within this list. */
  score: number
  /** Why it is being offered — shown as a small tag on the row. */
  reason: 'logged' | 'saved' | 'custom'
  /** Times this exact food has been logged. */
  timesLogged: number
  /** ISO date of the most recent log, for the "last had it" line. */
  lastDate?: string
}

/** Words too common to carry meaning in a food name. */
const STOP = new Set(['a', 'of', 'the', 'with', 'and', 'in', 'my', 'some'])

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    // Apostrophes join: "reese's" -> "reeses", so it matches "reeses".
    .replace(/['’]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOP.has(t))
}

/**
 * How well `candidate` answers `query`, 0 when it does not.
 *
 * Every query word must appear somewhere in the candidate — searching "peanut
 * butter pretzels" should not surface plain "peanut butter". Beyond that the
 * score rewards a tight match: covering more of the candidate's own words means
 * less unexplained extra, so "Reese's Filled Peanut Butter Pretzels" beats
 * "Peanut butter pretzel snack mix with raisins" for the same query.
 */
export function matchScore(query: string, candidate: string): number {
  const q = tokenize(query)
  const c = tokenize(candidate)
  if (q.length === 0 || c.length === 0) return 0

  let hits = 0
  for (const term of q) {
    // Prefix match, so "pretz" finds "pretzels" while you are still typing.
    if (c.some((word) => word === term || word.startsWith(term) || term.startsWith(word))) hits++
  }
  if (hits < q.length) return 0

  const coverage = hits / c.length
  const exact = q.join(' ') === c.join(' ') ? 1 : 0
  return 1 + coverage + exact
}

type Sources = {
  entries: FoodEntry[]
  savedMeals: SavedMeal[]
  customFoods: CustomFood[]
}

/**
 * Foods from your own history that match `query`, best first.
 *
 * Deduped by name so one food cannot occupy three rows by being recent AND
 * frequent AND saved.
 */
export function searchHistory(query: string, sources: Sources, limit = 5): HistoryMatch[] {
  if (!query.trim()) return []

  const byName = new Map<string, HistoryMatch>()

  const consider = (item: SavedMealItem, reason: HistoryMatch['reason'], date?: string) => {
    const score = matchScore(query, item.name)
    if (score === 0) return
    const key = item.name.trim().toLowerCase()
    const existing = byName.get(key)
    if (existing) {
      existing.timesLogged += reason === 'logged' ? 1 : 0
      // Keep the most recent date seen for this food.
      if (date && (!existing.lastDate || date > existing.lastDate)) existing.lastDate = date
      return
    }
    byName.set(key, { item, score, reason, timesLogged: reason === 'logged' ? 1 : 0, lastDate: date })
  }

  for (const entry of sources.entries) {
    consider(
      {
        name: entry.name,
        qty: entry.qty,
        unit: entry.unit,
        calories: entry.calories,
        protein: entry.protein,
        carbs: entry.carbs,
        fat: entry.fat,
      },
      'logged',
      entry.date,
    )
  }

  for (const meal of sources.savedMeals) {
    for (const item of meal.items) consider(item, 'saved')
  }

  for (const food of sources.customFoods) {
    consider(
      {
        name: food.brand ? `${food.name} (${food.brand})` : food.name,
        qty: 1,
        unit: food.serving,
        calories: food.per.calories,
        protein: food.per.protein,
        carbs: food.per.carbs,
        fat: food.per.fat,
      },
      'custom',
    )
  }

  return Array.from(byName.values())
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      // Then how often you eat it, then how recently.
      if (b.timesLogged !== a.timesLogged) return b.timesLogged - a.timesLogged
      return (b.lastDate ?? '').localeCompare(a.lastDate ?? '')
    })
    .slice(0, limit)
}

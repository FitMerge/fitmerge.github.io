// USDA FoodData Central search — the free U.S. government food database. Unlike
// OpenFoodFacts (branded/packaged products), FDC is rich in *generic* foods:
// "Potatoes, home fries", "Hash browns", restaurant dishes, raw ingredients. This
// is the diverse fallback that makes natural searches resolve like MyFitnessPal.
//
// Works out of the box with the shared DEMO_KEY (rate-limited to ~30 req/hour per
// IP). Users can paste a free personal key (fdc.nal.usda.gov/api-key-signup) in
// Settings to lift the limit — stored device-local, never synced.

import type { Macros } from '../../types'
import type { Extras, SearchFood } from './openFoodFacts'

const SEARCH_ENDPOINT = 'https://api.nal.usda.gov/fdc/v1/foods/search'
export const USDA_DEMO_KEY = 'DEMO_KEY'
// Generic datatypes only — Branded is already covered (better) by OpenFoodFacts,
// and excluding it keeps results generic and de-duplicated.
const DATA_TYPES = 'Foundation,SR Legacy,Survey (FNDDS)'

// FDC nutrient numbers (stable across datasets).
const N_ENERGY_KCAL = 1008
const N_PROTEIN = 1003
const N_FAT = 1004
const N_CARB = 1005
const N_FIBER = 1079
const N_SUGAR = 2000
const N_SODIUM = 1093

/** Raised when the API rejects us for rate-limiting (DEMO_KEY exhausted). */
export class UsdaRateLimitError extends Error {
  constructor() {
    super('USDA rate limit reached')
    this.name = 'UsdaRateLimitError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function coerceNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : fallback
}

/** Maps an FDC food's foodNutrients array to a nutrientId → value lookup (per 100 g). */
function nutrientMap(food: Record<string, unknown>): Map<number, number> {
  const map = new Map<number, number>()
  const list = Array.isArray(food.foodNutrients) ? food.foodNutrients : []
  for (const entry of list) {
    if (!isRecord(entry)) continue
    // Search results expose either { nutrientId, value } or { nutrientNumber, value }.
    const id = coerceNumber(entry.nutrientId ?? entry.nutrientNumber, NaN)
    const value = coerceNumber(entry.value, NaN)
    if (Number.isFinite(id) && Number.isFinite(value)) map.set(id, value)
  }
  return map
}

function buildExtras(n: Map<number, number>): Extras | undefined {
  const fiber = n.get(N_FIBER)
  const sugar = n.get(N_SUGAR)
  const sodiumMg = n.get(N_SODIUM)
  if (fiber === undefined && sugar === undefined && sodiumMg === undefined) return undefined
  const extras: Extras = {}
  if (fiber !== undefined) extras.fiber = fiber
  if (sugar !== undefined) extras.sugar = sugar
  if (sodiumMg !== undefined) extras.sodiumMg = sodiumMg
  return extras
}

/** Title-cases the ALL-CAPS descriptions some FDC entries use, leaving mixed case alone. */
function tidyName(raw: string): string {
  const name = raw.trim()
  if (name === name.toUpperCase() && /[A-Z]/.test(name)) {
    return name
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase())
  }
  return name
}

export function parseUsdaFood(raw: unknown): SearchFood | undefined {
  if (!isRecord(raw)) return undefined
  const description = typeof raw.description === 'string' ? tidyName(raw.description) : ''
  if (!description) return undefined

  const n = nutrientMap(raw)
  const calories = n.get(N_ENERGY_KCAL)
  if (calories === undefined) return undefined

  const per100g: Macros = {
    calories,
    protein: n.get(N_PROTEIN) ?? 0,
    carbs: n.get(N_CARB) ?? 0,
    fat: n.get(N_FAT) ?? 0,
  }
  const extras100g = buildExtras(n)

  // If FDC gives a gram serving size, expose a per-serving basis too.
  let perServing: Macros | undefined
  let servingText = '100 g'
  const servingSize = coerceNumber(raw.servingSize, NaN)
  const unit = typeof raw.servingSizeUnit === 'string' ? raw.servingSizeUnit.toLowerCase() : ''
  if (Number.isFinite(servingSize) && servingSize > 0 && (unit === 'g' || unit === 'gram')) {
    const factor = servingSize / 100
    perServing = {
      calories: Math.round(per100g.calories * factor * 10) / 10,
      protein: Math.round(per100g.protein * factor * 10) / 10,
      carbs: Math.round(per100g.carbs * factor * 10) / 10,
      fat: Math.round(per100g.fat * factor * 10) / 10,
    }
    servingText = `1 serving (${Math.round(servingSize)} g)`
  }

  const fdcId = coerceNumber(raw.fdcId, NaN)
  return {
    id: Number.isFinite(fdcId) ? `usda-${fdcId}` : `usda-${description}`,
    name: description,
    brand: undefined,
    servingText,
    per100g,
    perServing,
    extras100g,
  }
}

// In-memory per-session cache so repeat searches don't burn the rate limit.
const cache = new Map<string, SearchFood[]>()

export async function searchUsdaFoods(
  query: string,
  signal?: AbortSignal,
  apiKey?: string,
): Promise<SearchFood[]> {
  const trimmed = query.trim()
  if (!trimmed) return []
  const key = (apiKey && apiKey.trim()) || USDA_DEMO_KEY
  const cacheKey = `${key === USDA_DEMO_KEY ? 'demo' : 'user'}:${trimmed.toLowerCase()}`
  const cached = cache.get(cacheKey)
  if (cached) return cached

  const params = new URLSearchParams({
    query: trimmed,
    dataType: DATA_TYPES,
    pageSize: '20',
    api_key: key,
  })

  let res: Response
  try {
    res = await fetch(`${SEARCH_ENDPOINT}?${params.toString()}`, { signal })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    throw new Error('Network error — check your connection')
  }

  if (res.status === 429) throw new UsdaRateLimitError()
  if (!res.ok) throw new Error('USDA search failed — please try again')

  let payload: unknown
  try {
    payload = await res.json()
  } catch {
    throw new Error('USDA search returned an unexpected response')
  }

  if (!isRecord(payload) || !Array.isArray(payload.foods)) return []

  const results: SearchFood[] = []
  const seen = new Set<string>()
  for (const food of payload.foods) {
    const parsed = parseUsdaFood(food)
    if (!parsed) continue
    const nameKey = parsed.name.toLowerCase()
    if (seen.has(nameKey)) continue
    seen.add(nameKey)
    results.push(parsed)
  }

  cache.set(cacheKey, results)
  return results
}

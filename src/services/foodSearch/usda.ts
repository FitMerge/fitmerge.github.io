// USDA FoodData Central search — the free U.S. government food database. FDC is
// rich in *generic* foods ("Potatoes, home fries", raw ingredients) AND carries a
// ~1.9M-item Branded Foods dataset (packaged products and supplements) that beats
// OpenFoodFacts on U.S. coverage — so we query both and let the UI split them into
// "Generic" vs "Branded", MyFitnessPal-style.
//
// Works out of the box with the shared DEMO_KEY (rate-limited to ~30 req/hour per
// IP). Users can paste a free personal key (fdc.nal.usda.gov/api-key-signup) in
// Settings to lift the limit — stored device-local, never synced.

import type { Macros } from '../../types'
import type { Extras, SearchFood } from './openFoodFacts'

const SEARCH_ENDPOINT = 'https://api.nal.usda.gov/fdc/v1/foods/search'
export const USDA_DEMO_KEY = 'DEMO_KEY'
// Include Branded so packaged products and supplements (protein powders, bars,
// named brands) resolve — this is what makes searches like "1up iso vanilla ice
// cream" return the actual product instead of only generic whey powder.
const DATA_TYPES = 'Foundation,SR Legacy,Survey (FNDDS),Branded'

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

  // Branded foods carry a brand + a human serving label ("1 scoop (31g)").
  const brandName = typeof raw.brandName === 'string' ? raw.brandName.trim() : ''
  const brandOwner = typeof raw.brandOwner === 'string' ? raw.brandOwner.trim() : ''
  const brand = tidyBrand(brandName || brandOwner) || undefined
  const household =
    typeof raw.householdServingFullText === 'string' ? raw.householdServingFullText.trim() : ''

  // If FDC gives a gram/ml serving size, expose a per-serving basis too.
  let perServing: Macros | undefined
  let servingText = household || '100 g'
  const servingSize = coerceNumber(raw.servingSize, NaN)
  const unit = typeof raw.servingSizeUnit === 'string' ? raw.servingSizeUnit.toLowerCase() : ''
  if (Number.isFinite(servingSize) && servingSize > 0 && (unit === 'g' || unit === 'gram' || unit === 'ml')) {
    const factor = servingSize / 100
    perServing = {
      calories: Math.round(per100g.calories * factor * 10) / 10,
      protein: Math.round(per100g.protein * factor * 10) / 10,
      carbs: Math.round(per100g.carbs * factor * 10) / 10,
      fat: Math.round(per100g.fat * factor * 10) / 10,
    }
    if (!household) servingText = `1 serving (${Math.round(servingSize)} ${unit === 'ml' ? 'ml' : 'g'})`
  }

  const fdcId = coerceNumber(raw.fdcId, NaN)
  return {
    id: Number.isFinite(fdcId) ? `usda-${fdcId}` : `usda-${description}`,
    name: description,
    brand,
    servingText,
    per100g,
    perServing,
    extras100g,
  }
}

/** Brand strings arrive ALL-CAPS or mixed; title-case the shouty ones. */
function tidyBrand(raw: string): string {
  const b = raw.trim()
  if (!b) return ''
  if (b === b.toUpperCase() && /[A-Z]/.test(b)) return b.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
  return b
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
    pageSize: '40',
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
    // Key on name + brand so distinct branded products aren't collapsed, but exact
    // duplicates are.
    const dedupeKey = `${parsed.name.toLowerCase()}::${(parsed.brand ?? '').toLowerCase()}`
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)
    results.push(parsed)
  }

  cache.set(cacheKey, results)
  return results
}

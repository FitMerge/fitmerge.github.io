// OpenFoodFacts-backed food search. Free, keyless public API.

import type { Macros } from '../../types'
import { uid } from '../../lib/id'

export type Extras = {
  fiber?: number
  sugar?: number
  sodiumMg?: number
}

export type SearchFood = {
  id: string
  name: string
  brand?: string
  servingText: string
  per100g: Macros
  perServing?: Macros
  extras100g?: Extras
  extrasServing?: Extras
}

const SEARCH_ENDPOINT = 'https://world.openfoodfacts.org/cgi/search.pl'
const FIELDS = 'code,product_name,brands,serving_size,nutriments'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function coerceNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : fallback
}

function coerceOptionalNumber(value: unknown): number | undefined {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : undefined
}

/** Builds the fiber/sugar/sodium extras for a given OFF nutriments suffix ('100g' | 'serving'). */
function buildExtras(nutriments: Record<string, unknown>, suffix: '100g' | 'serving'): Extras | undefined {
  const fiber = coerceOptionalNumber(nutriments[`fiber_${suffix}`])
  const sugar = coerceOptionalNumber(nutriments[`sugars_${suffix}`])
  const sodiumG = coerceOptionalNumber(nutriments[`sodium_${suffix}`])
  const sodiumMg = sodiumG !== undefined ? sodiumG * 1000 : undefined

  if (fiber === undefined && sugar === undefined && sodiumMg === undefined) return undefined

  const extras: Extras = {}
  if (fiber !== undefined) extras.fiber = fiber
  if (sugar !== undefined) extras.sugar = sugar
  if (sodiumMg !== undefined) extras.sodiumMg = sodiumMg
  return extras
}

function buildUrl(query: string): string {
  const params = new URLSearchParams({
    search_terms: query,
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: '20',
    fields: FIELDS,
    sort_by: 'unique_scans_n',
    lc: 'en',
  })
  return `${SEARCH_ENDPOINT}?${params.toString()}`
}

export function parseProduct(raw: unknown): SearchFood | undefined {
  if (!isRecord(raw)) return undefined

  const name = typeof raw.product_name === 'string' ? raw.product_name.trim() : ''
  if (!name) return undefined

  const nutriments = isRecord(raw.nutriments) ? raw.nutriments : undefined
  if (!nutriments) return undefined

  const calories100 = coerceNumber(nutriments['energy-kcal_100g'], NaN)
  if (!Number.isFinite(calories100)) return undefined

  const per100g: Macros = {
    calories: calories100,
    protein: coerceNumber(nutriments['proteins_100g']),
    carbs: coerceNumber(nutriments['carbohydrates_100g']),
    fat: coerceNumber(nutriments['fat_100g']),
  }

  const extras100g = buildExtras(nutriments, '100g')

  let perServing: Macros | undefined
  let extrasServing: Extras | undefined
  const caloriesServing = coerceNumber(nutriments['energy-kcal_serving'], NaN)
  if (Number.isFinite(caloriesServing)) {
    perServing = {
      calories: caloriesServing,
      protein: coerceNumber(nutriments['proteins_serving']),
      carbs: coerceNumber(nutriments['carbohydrates_serving']),
      fat: coerceNumber(nutriments['fat_serving']),
    }
    extrasServing = buildExtras(nutriments, 'serving')
  }

  const brandsRaw = typeof raw.brands === 'string' ? raw.brands.trim() : ''
  const brand = brandsRaw ? brandsRaw.split(',')[0]?.trim() || undefined : undefined

  const servingText =
    typeof raw.serving_size === 'string' && raw.serving_size.trim() ? raw.serving_size.trim() : '100 g'

  const code = typeof raw.code === 'string' && raw.code.trim() ? raw.code.trim() : undefined

  return {
    id: code ?? uid(),
    name,
    brand,
    servingText,
    per100g,
    perServing,
    extras100g,
    extrasServing,
  }
}

/** Attempts for a 5xx. Measured live, OpenFoodFacts returned 503 on roughly half
 * of a burst of requests and succeeded on the very next try — so one shot at it
 * was throwing away results that were there. */
const ATTEMPTS = 3
const BACKOFF_MS = [250, 750]

const sleep = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(t)
      reject(new DOMException('Aborted', 'AbortError'))
    })
  })

export async function searchFoods(query: string, signal?: AbortSignal): Promise<SearchFood[]> {
  const trimmed = query.trim()
  if (!trimmed) return []

  let res: Response | undefined
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    try {
      res = await fetch(buildUrl(trimmed), { signal })
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') throw err
      // A dropped connection is worth one more go for the same reason a 503 is.
      if (attempt === ATTEMPTS - 1) throw new Error('Network error — check your connection')
      await sleep(BACKOFF_MS[attempt], signal)
      continue
    }
    // Only server-side wobble is worth retrying; a 400 will fail identically.
    if (res.status < 500) break
    if (attempt === ATTEMPTS - 1) break
    await sleep(BACKOFF_MS[attempt], signal)
  }

  if (!res || !res.ok) {
    throw new Error('Food search failed — please try again')
  }

  let payload: unknown
  try {
    payload = await res.json()
  } catch {
    throw new Error('Food search returned an unexpected response')
  }

  if (!isRecord(payload) || !Array.isArray(payload.products)) {
    return []
  }

  const results: SearchFood[] = []
  for (const product of payload.products) {
    const parsed = parseProduct(product)
    if (parsed) results.push(parsed)
  }

  return results
}

const PRODUCT_ENDPOINT = 'https://world.openfoodfacts.org/api/v2/product'

/**
 * Look up a single product by barcode. Resolves to null when the product is
 * unknown (status 0 or HTTP 404) — that is not an error condition.
 */
export async function fetchProductByBarcode(code: string, signal?: AbortSignal): Promise<SearchFood | null> {
  const trimmed = code.trim()
  if (!trimmed) return null

  const url = `${PRODUCT_ENDPOINT}/${encodeURIComponent(trimmed)}.json?fields=${FIELDS}`

  let res: Response
  try {
    res = await fetch(url, { signal })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    throw new Error('Network error — check your connection')
  }

  if (res.status === 404) return null
  if (!res.ok) {
    throw new Error('Barcode lookup failed — please try again')
  }

  let payload: unknown
  try {
    payload = await res.json()
  } catch {
    throw new Error('Barcode lookup returned an unexpected response')
  }

  if (!isRecord(payload) || payload.status !== 1) return null

  return parseProduct(payload.product) ?? null
}

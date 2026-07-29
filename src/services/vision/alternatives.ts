// Shared validation for the runners-up the model returns alongside each item.
//
// Lives apart from both callers because the describe path and the photo path
// must agree exactly: an alternative is written straight into the diary the
// moment it is tapped, so it gets the same clamping the headline item does.

import type { FoodAlternative } from './types'

/** More than this and the swap list becomes its own scrolling problem. */
export const MAX_ALTERNATIVES = 8

function coerceNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : fallback
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * Validate a raw `alternatives` array. Always returns an array — a model that
 * omits the key, or fills it with junk, degrades to "no swaps offered" rather
 * than breaking the item it belongs to.
 *
 * `headlineName` is dropped from the list: the model likes to repeat its own top
 * pick as the first alternative, and offering you a swap to what you already
 * have reads as a bug.
 */
export function parseAlternatives(raw: unknown, headlineName: string): FoodAlternative[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>([headlineName.trim().toLowerCase()])
  const out: FoodAlternative[] = []

  for (const entry of raw) {
    if (out.length >= MAX_ALTERNATIVES) break
    if (!isRecord(entry)) continue
    const name = typeof entry.name === 'string' ? entry.name.trim() : ''
    if (!name) continue
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)

    out.push({
      name,
      servingText:
        typeof entry.servingText === 'string' && entry.servingText.trim()
          ? entry.servingText.trim()
          : '1 serving',
      calories: clamp(Math.round(coerceNumber(entry.calories)), 0, 10_000),
      protein: clamp(Math.round(coerceNumber(entry.protein)), 0, 1_000),
      carbs: clamp(Math.round(coerceNumber(entry.carbs)), 0, 1_000),
      fat: clamp(Math.round(coerceNumber(entry.fat)), 0, 1_000),
    })
  }
  return out
}

/** The JSON shape asked of the model, shared so the two prompts cannot drift. */
export const ALTERNATIVES_PROMPT = `Also return "alternatives" for every item: the next ${MAX_ALTERNATIVES} most likely identifications you considered and rejected, best first. Each alternative needs the same fields as the item except confidence. Make them genuinely different foods or preparations that the description or photo could plausibly mean (e.g. for "oil": olive oil, butter, ghee, coconut oil), NOT restatements of the same food. If nothing else is plausible, return an empty array.`

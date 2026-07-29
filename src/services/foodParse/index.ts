// Turn a plain-English description of a meal into per-item macros.
//
// This is the path people actually reach for: "chicken burrito bowl with rice,
// black beans and guac" is how a meal is remembered, and forcing that through a
// database search — one row at a time, each needing a serving size — is why the
// diary gets abandoned. The photo analyser already proved the shape works; this
// is the same contract without needing a camera.
//
// Reuses the vision provider's item type deliberately, so the review UI, the
// confidence badges and the diary write path are shared rather than duplicated.

import { generateContent } from '../gemini/model'
import { VisionError, type FoodAnalysisItem } from '../vision/types'
import { ALTERNATIVES_PROMPT, parseAlternatives } from '../vision/alternatives'

export type { FoodAnalysisItem } from '../vision/types'
export { VisionError } from '../vision/types'

export type FoodParseResult = {
  items: FoodAnalysisItem[]
  /** Echoed back so the review screen can show what was actually understood. */
  query: string
}

const PROMPT = `You are a nutrition expert. The user describes what they ate in plain language. Break it into distinct food or drink items and estimate the macros for the portion described.

Rules:
- If a quantity is given ("two eggs", "large coffee", "8oz sirloin"), use it. If not, assume one typical serving.
- Split a composite dish into its components ONLY when the user listed them ("burrito bowl with rice, beans, guac" -> rice, beans, guac, plus the base). Otherwise keep a named dish as one item ("pad thai" stays one item).
- servingText must state the portion you assumed, e.g. "2 large eggs" or "1 cup, ~150g".
- confidence reflects how sure you are about BOTH the identity and the portion: a precisely stated weight is high, a vague "some chips" is low.
- Ignore anything that is not food or drink.

Respond with STRICT JSON only, no markdown, no code fences, no commentary, no extra keys:

{"items":[{"name":string,"servingText":string,"calories":number,"protein":number,"carbs":number,"fat":number,"confidence":number between 0 and 1,"alternatives":[{"name":string,"servingText":string,"calories":number,"protein":number,"carbs":number,"fat":number}]}]}

${ALTERNATIVES_PROMPT}

If the text describes no food at all, return {"items":[]}.

The user ate:
`

function stripCodeFences(text: string): string {
  const trimmed = text.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  return fenced ? fenced[1] : trimmed
}

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

/** Validate and clamp whatever the model returned — macros are written straight
 * into the diary, so a negative or absurd number must never reach the store. */
export function parseFoodItems(raw: unknown): FoodAnalysisItem[] {
  if (!isRecord(raw) || !Array.isArray(raw.items)) {
    throw new VisionError('Could not read that — try describing the food differently')
  }

  const items: FoodAnalysisItem[] = []
  for (const entry of raw.items) {
    if (!isRecord(entry)) continue
    const name = typeof entry.name === 'string' ? entry.name.trim() : ''
    if (!name) continue
    items.push({
      name,
      servingText: typeof entry.servingText === 'string' ? entry.servingText.trim() : '1 serving',
      calories: clamp(Math.round(coerceNumber(entry.calories)), 0, 10_000),
      protein: clamp(Math.round(coerceNumber(entry.protein)), 0, 1_000),
      carbs: clamp(Math.round(coerceNumber(entry.carbs)), 0, 1_000),
      fat: clamp(Math.round(coerceNumber(entry.fat)), 0, 1_000),
      confidence: clamp(coerceNumber(entry.confidence, 0.5), 0, 1),
      alternatives: parseAlternatives(entry.alternatives, name),
    })
  }
  return items
}

/**
 * Ask the model to break `description` into items with macros. Requires a Gemini
 * key — unlike the photo path there's no offline mock, because a plausible-looking
 * fabricated breakdown of real food someone is about to eat is worse than an
 * honest "this needs a key".
 */
export async function parseFoodDescription(
  description: string,
  apiKey: string | undefined,
): Promise<FoodParseResult> {
  const query = description.trim()
  if (!query) throw new VisionError('Describe what you ate first')

  const key = apiKey?.trim()
  if (!key) {
    throw new VisionError('Add a Gemini API key in Settings → AI to describe meals in your own words')
  }

  const body = {
    contents: [{ parts: [{ text: `${PROMPT}${query}` }] }],
    generationConfig: {
      response_mime_type: 'application/json',
      // Low, not zero: macro estimation benefits from a little flexibility, but
      // the same meal typed twice should land in the same place.
      temperature: 0.2,
    },
  }

  // generateContent discovers a working text model, POSTs, and self-heals on a
  // 404, so a retired model id can't quietly break this the way it has before.
  let text: string
  try {
    text = await generateContent('text', key, body)
  } catch (cause) {
    throw new VisionError(cause instanceof Error ? cause.message : 'Could not reach the AI service', cause)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(stripCodeFences(text))
  } catch (cause) {
    throw new VisionError('Could not read that — try describing the food differently', cause)
  }

  const items = parseFoodItems(parsed)
  if (items.length === 0) {
    throw new VisionError("That didn't look like food — try naming the dish and roughly how much")
  }
  return { items, query }
}

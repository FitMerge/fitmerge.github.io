// Gemini-backed vision provider. Sends the downscaled photo to the Gemini API
// and asks for a strict-JSON breakdown of the food items visible.

import type { FoodAnalysis, FoodAnalysisItem } from './types'
import { VisionError } from './types'
import { generateContent } from '../gemini/model'

const PROMPT = `You are a nutrition expert analyzing a photo of food. Identify each distinct food or drink item visible in the photo and estimate the visible portion size for each.

Respond with STRICT JSON only, no markdown formatting, no code fences, no extra commentary, and no extra keys. Use exactly this shape:

{"items":[{"name":string,"servingText":string (e.g. "1 cup, ~150g"),"calories":number,"protein":number,"carbs":number,"fat":number,"confidence":number between 0 and 1}]}

Estimate calories, protein (g), carbs (g), and fat (g) for the portion shown. If you cannot identify any food, return {"items":[]}.`

function stripDataUrlPrefix(dataUrl: string): string {
  const commaIdx = dataUrl.indexOf(',')
  return commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl
}

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

function parseItems(raw: unknown): FoodAnalysisItem[] {
  if (!isRecord(raw) || !Array.isArray(raw.items)) {
    throw new VisionError('Could not identify food in this photo')
  }

  const items: FoodAnalysisItem[] = []

  for (const entry of raw.items) {
    if (!isRecord(entry)) continue

    const name = typeof entry.name === 'string' ? entry.name.trim() : ''
    if (!name) continue

    const calories = coerceNumber(entry.calories)
    if (!Number.isFinite(calories)) continue

    const servingText = typeof entry.servingText === 'string' && entry.servingText.trim()
      ? entry.servingText.trim()
      : 'serving'

    items.push({
      name,
      servingText,
      calories: Math.max(0, calories),
      protein: Math.max(0, coerceNumber(entry.protein)),
      carbs: Math.max(0, coerceNumber(entry.carbs)),
      fat: Math.max(0, coerceNumber(entry.fat)),
      confidence: clamp(coerceNumber(entry.confidence, 0.6), 0, 1),
    })
  }

  if (items.length === 0) {
    throw new VisionError('Could not identify food in this photo')
  }

  return items
}

export async function analyzeGemini(imageDataUrl: string, apiKey: string): Promise<FoodAnalysis> {
  const body = {
    contents: [
      {
        parts: [
          { text: PROMPT },
          {
            inline_data: {
              mime_type: 'image/jpeg',
              data: stripDataUrlPrefix(imageDataUrl),
            },
          },
        ],
      },
    ],
    generationConfig: {
      response_mime_type: 'application/json',
      temperature: 0.2,
    },
  }

  // generateContent discovers a working vision model, POSTs, and self-heals on a
  // 404/transient failure — so a retired or renamed model no longer breaks photos.
  let text: string
  try {
    text = await generateContent('vision', apiKey, body)
  } catch (err) {
    throw new VisionError(err instanceof Error ? err.message : 'Gemini request failed — please try again')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(stripCodeFences(text))
  } catch (err) {
    throw new VisionError('Could not identify food in this photo', err)
  }

  const items = parseItems(parsed)

  return { items, provider: 'gemini' }
}

// Gemini-backed vision provider. Sends the downscaled photo to the Gemini API
// and asks for a strict-JSON breakdown of the food items visible.

import type { FoodAnalysis, FoodAnalysisItem } from './types'
import { VisionError } from './types'

const MODEL_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

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

function statusMessage(status: number): string {
  if (status === 400 || status === 403) return 'Invalid Gemini API key — check Settings'
  if (status === 429) return 'Gemini is busy (free-tier rate limit) — wait a moment and try again'
  return 'Gemini request failed — please try again'
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Free-tier rate limits (429) are usually a short burst; back off and retry a
// couple of times so a transient limit recovers on its own instead of erroring.
const RETRY_DELAYS_MS = [2500, 6000]

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

  let res: Response | undefined
  for (let attempt = 0; ; attempt++) {
    try {
      res = await fetch(`${MODEL_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    } catch (err) {
      throw new VisionError('Network error — check your connection', err)
    }
    // Retry only on a rate limit, with backoff; any other status is final.
    if (res.status === 429 && attempt < RETRY_DELAYS_MS.length) {
      await sleep(RETRY_DELAYS_MS[attempt])
      continue
    }
    break
  }

  if (!res.ok) {
    throw new VisionError(statusMessage(res.status))
  }

  let payload: unknown
  try {
    payload = await res.json()
  } catch (err) {
    throw new VisionError('Gemini returned an unexpected response', err)
  }

  const text = extractText(payload)
  if (!text) {
    throw new VisionError('Gemini returned an unexpected response')
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

function extractText(payload: unknown): string | undefined {
  if (!isRecord(payload)) return undefined
  const candidates = payload.candidates
  if (!Array.isArray(candidates) || candidates.length === 0) return undefined

  const first = candidates[0]
  if (!isRecord(first)) return undefined
  const content = first.content
  if (!isRecord(content)) return undefined
  const parts = content.parts
  if (!Array.isArray(parts) || parts.length === 0) return undefined

  const firstPart = parts[0]
  if (!isRecord(firstPart)) return undefined
  const text = firstPart.text
  return typeof text === 'string' ? text : undefined
}

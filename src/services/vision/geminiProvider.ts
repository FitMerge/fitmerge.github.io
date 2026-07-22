// Gemini-backed vision provider. Sends the downscaled photo to the Gemini API
// and asks for a strict-JSON breakdown of the food items visible.

import type { FoodAnalysis, FoodAnalysisItem } from './types'
import { VisionError } from './types'
import { geminiEndpoint, readGeminiError } from '../gemini/client'

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// A transient (per-minute) rate limit is a short burst; back off and retry a couple
// of times so it recovers on its own. Daily-quota exhaustion and other errors are
// final — readGeminiError tells us which is which so we don't retry in vain.
const MAX_RETRIES = 2
const FALLBACK_RETRY_MS = [2500, 6000]

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
      res = await fetch(`${geminiEndpoint()}?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    } catch (err) {
      throw new VisionError('Network error — check your connection', err)
    }
    if (res.ok) break
    // Retry only transient (retryable) failures — a per-minute rate limit or a 5xx —
    // honoring the server's suggested delay when it gives one. Everything else is final.
    const info = await readGeminiError(res)
    if (info.retryable && attempt < MAX_RETRIES) {
      await sleep(info.retryAfterMs ?? FALLBACK_RETRY_MS[attempt] ?? 6000)
      continue
    }
    throw new VisionError(info.message)
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

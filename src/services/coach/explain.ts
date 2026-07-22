// "Explain this" — sends a compact, text summary of what the user is currently
// looking at (their PMC numbers + recent recovery signals) to Gemini and returns
// a plain-English coach interpretation. Reuses the same Gemini key the photo
// analyzer uses. Text in, text out — no JSON schema.

import { geminiEndpoint, readGeminiError } from '../gemini/client'

export class CoachError extends Error {}

const SYSTEM = `You are an elite endurance coach and exercise physiologist. A user is looking at their own training-analytics dashboard built from Garmin data. Given the numbers below, explain in plain, encouraging language what they mean for this person: their current fitness/fatigue/form balance, recovery status, any red flags, and one or two concrete things to do next. Be specific and reference the actual numbers. Keep it under 180 words. Do not use markdown headers; short paragraphs or a few bullet points are fine.`

export async function explainCoachData(summary: string, apiKey: string): Promise<string> {
  if (!apiKey.trim()) {
    throw new CoachError('Add a Gemini API key in Settings → AI photo analysis to use "Explain this".')
  }

  const body = {
    contents: [{ parts: [{ text: `${SYSTEM}\n\n---\n${summary}` }] }],
    generationConfig: { temperature: 0.4 },
  }

  let res: Response
  try {
    res = await fetch(`${geminiEndpoint()}?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch (err) {
    throw new CoachError('Network error — check your connection.')
  }

  if (!res.ok) {
    const info = await readGeminiError(res)
    throw new CoachError(info.message)
  }

  let payload: unknown
  try {
    payload = await res.json()
  } catch {
    throw new CoachError('Gemini returned an unexpected response.')
  }

  const text = extractText(payload)
  if (!text) throw new CoachError('Gemini returned an empty response.')
  return text.trim()
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

function extractText(payload: unknown): string | undefined {
  if (!isRecord(payload)) return undefined
  const candidates = payload.candidates
  if (!Array.isArray(candidates) || candidates.length === 0) return undefined
  const content = isRecord(candidates[0]) ? candidates[0].content : undefined
  const parts = isRecord(content) ? content.parts : undefined
  if (!Array.isArray(parts)) return undefined
  const texts = parts.map((p) => (isRecord(p) && typeof p.text === 'string' ? p.text : '')).filter(Boolean)
  return texts.join('\n')
}

// "Explain this" — sends a compact, text summary of what the user is currently
// looking at (their PMC numbers + recent recovery signals) to Gemini and returns
// a plain-English coach interpretation. Reuses the same Gemini key the photo
// analyzer uses. Text in, text out — no JSON schema.

import { generateContent } from '../gemini/model'

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

  try {
    const text = await generateContent('text', apiKey, body)
    return text.trim()
  } catch (err) {
    throw new CoachError(err instanceof Error ? err.message : 'Gemini request failed — please try again.')
  }
}

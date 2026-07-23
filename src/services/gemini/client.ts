// Central config + error handling for the Gemini REST API. Both the food-photo
// vision provider and the "Explain this" coach call these, so the model name and
// quota-aware error handling live in ONE place — when a hardcoded model gets
// retired (as gemini-2.0-flash did on 2026-03-03, which is what made the AI
// features look permanently "rate-limited"), it's a one-line fix here.

// gemini-2.5-flash is the current GA multimodal Flash model. Free tier covers it
// (~10 req/min, ~250 req/day as of 2026), which is ample for personal use, and it
// still does vision for photo macro analysis. Change this single constant if
// Google retires it again.
export const GEMINI_MODEL = 'gemini-2.5-flash'

// A lighter, cheaper model with a bigger free-tier daily allowance (~1000/day vs
// ~250). Ideal for text-only jobs like parsing a natural-language log command, so
// those requests don't eat into the photo-analysis budget on gemini-2.5-flash.
export const GEMINI_LITE_MODEL = 'gemini-2.5-flash-lite'

export function geminiEndpoint(model = GEMINI_MODEL): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

/** Pull the useful bits out of a Gemini error JSON body: which quota was hit and
 * any server-suggested retry delay. Both live under `error.details[]`. */
function extractErrorDetail(body: unknown): { quotaId?: string; retryAfterMs?: number } {
  const error = isRecord(body) ? body.error : undefined
  const details = isRecord(error) && Array.isArray(error.details) ? error.details : []
  let quotaId: string | undefined
  let retryAfterMs: number | undefined

  for (const d of details) {
    if (!isRecord(d)) continue
    const type = typeof d['@type'] === 'string' ? (d['@type'] as string) : ''
    if (type.includes('QuotaFailure') && Array.isArray(d.violations)) {
      for (const v of d.violations) {
        if (isRecord(v) && typeof v.quotaId === 'string') quotaId = v.quotaId
      }
    }
    if (type.includes('RetryInfo') && typeof d.retryDelay === 'string') {
      const m = d.retryDelay.match(/^([\d.]+)s$/)
      if (m) retryAfterMs = Math.round(parseFloat(m[1]) * 1000)
    }
  }
  return { quotaId, retryAfterMs }
}

export type GeminiErrorInfo = { message: string; retryable: boolean; retryAfterMs?: number }

/**
 * Turn a non-OK Gemini response into an accurate, actionable message. The old code
 * called every 429 a transient "wait a moment" limit, which was wrong when the real
 * cause was the daily free-tier quota (won't recover for hours) or a retired model.
 */
export async function readGeminiError(res: Response): Promise<GeminiErrorInfo> {
  let body: unknown
  try {
    body = await res.clone().json()
  } catch {
    body = undefined
  }

  if (res.status === 400 || res.status === 403) {
    return { message: 'Invalid or unauthorized Gemini API key — check Settings → AI photo analysis.', retryable: false }
  }
  if (res.status === 404) {
    return { message: 'The Gemini model is unavailable — the app may need updating.', retryable: false }
  }
  if (res.status === 429) {
    const { quotaId, retryAfterMs } = extractErrorDetail(body)
    const perDay = /per.?day/i.test(quotaId ?? '')
    if (perDay) {
      return {
        message:
          "You've used up today's free Gemini requests. The free quota resets around midnight Pacific — or add billing to your Google AI Studio project for higher limits.",
        retryable: false,
      }
    }
    return { message: 'Gemini is briefly rate-limited — try again in a few seconds.', retryable: true, retryAfterMs }
  }
  if (res.status >= 500) {
    return { message: 'Gemini is temporarily unavailable — please try again.', retryable: true }
  }
  return { message: 'Gemini request failed — please try again.', retryable: false }
}

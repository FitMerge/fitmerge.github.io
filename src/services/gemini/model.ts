// Model discovery + a single call path for the Gemini REST API. Hardcoding a model
// id has now broken the AI features twice (gemini-2.0-flash was retired; a guessed
// flash-lite id 404'd for the user's key). So instead of trusting a constant, we ask
// the key's own ListModels endpoint what it can actually use, pick the best match by
// preference, cache it, and self-heal: if a call 404s we refresh the list and retry.

import { GEMINI_LITE_MODEL, GEMINI_MODEL, readGeminiError } from './client'

const API = 'https://generativelanguage.googleapis.com/v1beta'
const CACHE_KEY = 'fm-gemini-models'
const TTL_MS = 6 * 60 * 60 * 1000 // re-check available models every 6h

export type ModelKind = 'text' | 'vision'

// Preference order per job. First available wins. "-latest" aliases are Google-
// maintained pointers to the current model, so they survive future retirements.
const PREFS: Record<ModelKind, string[]> = {
  text: ['gemini-flash-lite-latest', GEMINI_LITE_MODEL, 'gemini-flash-latest', GEMINI_MODEL, 'gemini-2.0-flash'],
  vision: ['gemini-flash-latest', GEMINI_MODEL, 'gemini-flash-lite-latest', GEMINI_LITE_MODEL, 'gemini-2.0-flash'],
}

type Cache = { names: string[]; ts: number }

function readCache(): Cache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const c = JSON.parse(raw) as Cache
    return Array.isArray(c.names) && typeof c.ts === 'number' ? c : null
  } catch {
    return null
  }
}

function writeCache(names: string[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ names, ts: Date.now() } satisfies Cache))
  } catch {
    /* private mode / quota — fine, we just re-fetch next time */
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

/** Model ids (without the "models/" prefix) that support generateContent. */
async function fetchModelNames(apiKey: string): Promise<string[]> {
  const res = await fetch(`${API}/models?key=${encodeURIComponent(apiKey)}&pageSize=200`)
  if (!res.ok) throw new Error((await readGeminiError(res)).message)
  const payload: unknown = await res.json()
  const models = isRecord(payload) && Array.isArray(payload.models) ? payload.models : []
  const names: string[] = []
  for (const m of models) {
    if (!isRecord(m)) continue
    const methods = Array.isArray(m.supportedGenerationMethods) ? m.supportedGenerationMethods : []
    if (!methods.includes('generateContent')) continue
    const name = typeof m.name === 'string' ? m.name.replace(/^models\//, '') : ''
    if (name) names.push(name)
  }
  return names
}

function pick(available: string[], kind: ModelKind): string | null {
  for (const pref of PREFS[kind]) if (available.includes(pref)) return pref
  // Fall back to any flash-ish model the key exposes before giving up.
  return available.find((n) => n.includes('flash')) ?? available[0] ?? null
}

/** Resolve a usable model id for `kind`, using the cached ListModels result unless
 * `force` (used after a 404) or the cache is stale/empty. */
export async function resolveModel(apiKey: string, kind: ModelKind, force = false): Promise<string> {
  const cache = readCache()
  const fresh = cache && !force && Date.now() - cache.ts < TTL_MS
  if (fresh && cache) {
    const chosen = pick(cache.names, kind)
    if (chosen) return chosen
  }
  try {
    const names = await fetchModelNames(apiKey)
    writeCache(names)
    const chosen = pick(names, kind)
    if (chosen) return chosen
  } catch {
    // ListModels failed (offline, bad key). Fall back to stale cache, then to the
    // first preference as a blind guess so the call can still be attempted.
    if (cache) {
      const chosen = pick(cache.names, kind)
      if (chosen) return chosen
    }
  }
  return PREFS[kind][0]
}

function extractText(payload: unknown): string | undefined {
  if (!isRecord(payload)) return undefined
  const candidates = payload.candidates
  if (!Array.isArray(candidates) || !candidates.length) return undefined
  const content = isRecord(candidates[0]) ? candidates[0].content : undefined
  const parts = isRecord(content) ? content.parts : undefined
  if (!Array.isArray(parts) || !parts.length) return undefined
  const text = isRecord(parts[0]) ? parts[0].text : undefined
  return typeof text === 'string' ? text : undefined
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const RETRY_MS = [2500, 6000]

/**
 * One place every Gemini generateContent call goes through. Resolves a working
 * model, POSTs the body, and on failure does the right thing: refresh-and-retry once
 * on a 404 (model retired/renamed), back off and retry a transient rate-limit/5xx,
 * and surface an accurate message otherwise. Returns the model's text output.
 */
export async function generateContent(kind: ModelKind, apiKey: string, body: unknown): Promise<string> {
  let model = await resolveModel(apiKey, kind)
  let refreshed = false

  for (let attempt = 0; ; attempt++) {
    let res: Response
    try {
      res = await fetch(`${API}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    } catch {
      throw new Error('Network error — check your connection.')
    }

    if (res.ok) {
      const text = extractText(await res.json())
      if (!text) throw new Error('The AI returned an empty response.')
      return text
    }

    // A 404 means this model id is gone/renamed — rediscover once and retry.
    if (res.status === 404 && !refreshed) {
      refreshed = true
      model = await resolveModel(apiKey, kind, true)
      continue
    }

    const info = await readGeminiError(res)
    if (info.retryable && attempt < RETRY_MS.length) {
      await sleep(info.retryAfterMs ?? RETRY_MS[attempt])
      continue
    }
    throw new Error(info.message)
  }
}

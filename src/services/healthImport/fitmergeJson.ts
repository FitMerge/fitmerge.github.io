// Parser for the documented FitMerge health-import JSON format (version 1):
//
// {
//   "version": 1,
//   "weights": [{ "date": "YYYY-MM-DD", "weightKg": number, "bodyFatPct"?: number }],
//   "sessions": [{ "name": string, "date": "YYYY-MM-DD", "durationMin"?: number, "kcal"?: number }]
// }
//
// This is the format emitted by scripts/garmin-sync.py and by asking Claude (with a Garmin
// MCP server) to produce a FitMerge import file. Validation follows the unknown-narrowing
// style used by services/vision/geminiProvider.ts — never trust the shape of parsed JSON.

import type { BodyEntry, HealthDay } from '../../types'
import type { HealthImportResult, ImportedSessionInput } from './types'
import {
  coerceFiniteNumber,
  ISO_DATE_RE,
  isRecord,
  NUMERIC_SESSION_FIELDS,
  STRING_SESSION_FIELDS,
} from './types'

/** Parse one day of wellness metrics. Accepts either { date, metrics: {...} } or a
 * flat { date, steps, sleepScore, ... } shape — every finite numeric field becomes
 * a metric, so the schema never needs to change as Garmin exposes new metrics. */
function parseHealthDay(raw: unknown): HealthDay | undefined {
  if (!isRecord(raw)) return undefined
  const date = typeof raw.date === 'string' ? raw.date : ''
  if (!ISO_DATE_RE.test(date)) return undefined
  const src = isRecord(raw.metrics) ? raw.metrics : raw
  const metrics: Record<string, number> = {}
  for (const [k, v] of Object.entries(src)) {
    if (k === 'date' || k === 'metrics') continue
    const n = coerceFiniteNumber(v)
    if (n !== undefined) metrics[k] = n
  }
  if (Object.keys(metrics).length === 0) return undefined
  return { date, metrics }
}

function parseWeight(raw: unknown): BodyEntry | undefined {
  if (!isRecord(raw)) return undefined
  const date = typeof raw.date === 'string' ? raw.date : ''
  if (!ISO_DATE_RE.test(date)) return undefined

  const weightKg = coerceFiniteNumber(raw.weightKg)
  if (weightKg === undefined || weightKg <= 0) return undefined

  const bodyFatPct = coerceFiniteNumber(raw.bodyFatPct)

  const entry: BodyEntry = { date, weightKg }
  if (bodyFatPct !== undefined && bodyFatPct > 0) entry.bodyFatPct = bodyFatPct
  return entry
}

function parseSession(raw: unknown): ImportedSessionInput | undefined {
  if (!isRecord(raw)) return undefined
  const date = typeof raw.date === 'string' ? raw.date : ''
  if (!ISO_DATE_RE.test(date)) return undefined

  const name = typeof raw.name === 'string' ? raw.name.trim() : ''
  if (!name) return undefined

  const session: ImportedSessionInput = { name, date }
  for (const [field, floor] of NUMERIC_SESSION_FIELDS) {
    const n = coerceFiniteNumber(raw[field])
    if (n !== undefined && n >= floor) (session as Record<string, unknown>)[field] = n
  }
  for (const field of STRING_SESSION_FIELDS) {
    const v = raw[field]
    if (typeof v === 'string' && v.trim()) (session as Record<string, unknown>)[field] = v.trim()
  }
  return session
}

export function parseFitmergeJson(text: string): HealthImportResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Not a FitMerge import file')
  }

  if (!isRecord(parsed) || parsed.version !== 1) {
    throw new Error('Not a FitMerge import file')
  }

  const rawWeights = Array.isArray(parsed.weights) ? parsed.weights : []
  const rawSessions = Array.isArray(parsed.sessions) ? parsed.sessions : []
  const rawHealth = Array.isArray(parsed.health) ? parsed.health : []

  const weights = rawWeights.map(parseWeight).filter((w): w is BodyEntry => w !== undefined)
  const sessions = rawSessions
    .map(parseSession)
    .filter((s): s is ImportedSessionInput => s !== undefined)
  const health = rawHealth.map(parseHealthDay).filter((h): h is HealthDay => h !== undefined)

  if (weights.length === 0 && sessions.length === 0 && health.length === 0) {
    throw new Error('Not a FitMerge import file')
  }

  return { weights, sessions, health, source: 'fitmerge-json' }
}

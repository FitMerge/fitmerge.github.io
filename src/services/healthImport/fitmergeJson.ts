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

import type { BodyEntry } from '../../types'
import type { HealthImportResult, ImportedSessionInput } from './types'
import { coerceFiniteNumber, ISO_DATE_RE, isRecord } from './types'

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

  const durationMin = coerceFiniteNumber(raw.durationMin)
  const kcal = coerceFiniteNumber(raw.kcal)

  const session: ImportedSessionInput = { name, date }
  if (durationMin !== undefined && durationMin >= 0) session.durationMin = durationMin
  if (kcal !== undefined && kcal >= 0) session.kcal = kcal
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

  const weights = rawWeights.map(parseWeight).filter((w): w is BodyEntry => w !== undefined)
  const sessions = rawSessions
    .map(parseSession)
    .filter((s): s is ImportedSessionInput => s !== undefined)

  if (weights.length === 0 && sessions.length === 0) {
    throw new Error('Not a FitMerge import file')
  }

  return { weights, sessions, source: 'fitmerge-json' }
}

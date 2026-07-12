// Parser for Garmin Connect CSV exports. Garmin's web UI exports two different shapes under
// "Reports": a weight-history CSV (Date, Weight, ...) and an activities CSV (Activity Type,
// Date, Title, Time, Calories, ...). We sniff the header row to tell them apart.

import type { BodyEntry } from '../../types'
import type { HealthImportResult, ImportedSessionInput } from './types'
import { ISO_DATE_RE } from './types'

/** Hand-rolled CSV parser: handles quoted fields, commas-in-quotes, and "" escaped quotes. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (c !== '\r') {
      field += c
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ''))
}

function toISOLocal(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Accepts "YYYY-MM-DD" (with optional time suffix) or human formats like "Jul 12, 2026". */
function parseDateFlexible(raw: string): string | undefined {
  const trimmed = raw.trim()
  if (!trimmed) return undefined

  const isoMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})/)
  if (isoMatch) return isoMatch[1]

  const parsed = new Date(trimmed)
  if (!Number.isNaN(parsed.getTime())) return toISOLocal(parsed)

  return undefined
}

function parseWeightValue(cell: string, header: string): number | undefined {
  const trimmed = cell.trim()
  const numMatch = trimmed.match(/-?\d+(\.\d+)?/)
  if (!numMatch) return undefined
  const num = Number(numMatch[0])
  if (!Number.isFinite(num) || num <= 0) return undefined

  const isLb = trimmed.toLowerCase().includes('lb') || header.toLowerCase().includes('lb')
  return isLb ? num / 2.20462 : num
}

/** "hh:mm:ss" or "mm:ss" duration string -> minutes. */
function parseDurationMin(raw: string): number | undefined {
  const parts = raw.trim().split(':').map(Number)
  if (parts.length < 2 || parts.some((n) => !Number.isFinite(n))) return undefined
  if (parts.length === 3) {
    const [h, m, s] = parts
    return h * 60 + m + s / 60
  }
  const [m, s] = parts
  return m + s / 60
}

function parseCalories(raw: string): number | undefined {
  const cleaned = raw.replace(/,/g, '').trim()
  const n = Number(cleaned)
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

function findHeaderIndex(headers: string[], predicate: (h: string) => boolean): number {
  return headers.findIndex((h) => predicate(h.trim().toLowerCase()))
}

function parseWeightCsv(headers: string[], rows: string[][]): BodyEntry[] {
  const dateIdx = findHeaderIndex(headers, (h) => h.includes('date'))
  const weightIdx = findHeaderIndex(headers, (h) => h.includes('weight') && !h.includes('goal'))
  if (dateIdx < 0 || weightIdx < 0) return []

  const byDate = new Map<string, BodyEntry>()
  for (const row of rows) {
    const date = parseDateFlexible(row[dateIdx] ?? '')
    if (!date || !ISO_DATE_RE.test(date)) continue
    const weightKg = parseWeightValue(row[weightIdx] ?? '', headers[weightIdx])
    if (weightKg === undefined) continue
    byDate.set(date, { date, weightKg })
  }
  return Array.from(byDate.values())
}

function parseActivitiesCsv(headers: string[], rows: string[][]): ImportedSessionInput[] {
  const typeIdx = findHeaderIndex(headers, (h) => h.includes('activity type'))
  const dateIdx = findHeaderIndex(headers, (h) => h.includes('date'))
  const titleIdx = findHeaderIndex(headers, (h) => h.includes('title'))
  const timeIdx = findHeaderIndex(headers, (h) => h === 'time' || h.includes('moving time'))
  const caloriesIdx = findHeaderIndex(headers, (h) => h.includes('calories'))

  if (dateIdx < 0 || (typeIdx < 0 && titleIdx < 0)) return []

  const sessions: ImportedSessionInput[] = []
  for (const row of rows) {
    const date = parseDateFlexible(row[dateIdx] ?? '')
    if (!date || !ISO_DATE_RE.test(date)) continue

    const title = titleIdx >= 0 ? (row[titleIdx] ?? '').trim() : ''
    const activityType = typeIdx >= 0 ? (row[typeIdx] ?? '').trim() : ''
    const name = title || activityType
    if (!name) continue

    const session: ImportedSessionInput = { name, date }
    if (timeIdx >= 0) {
      const durationMin = parseDurationMin(row[timeIdx] ?? '')
      if (durationMin !== undefined) session.durationMin = durationMin
    }
    if (caloriesIdx >= 0) {
      const kcal = parseCalories(row[caloriesIdx] ?? '')
      if (kcal !== undefined) session.kcal = kcal
    }
    sessions.push(session)
  }
  return sessions
}

export function parseGarminCsv(text: string): HealthImportResult {
  const rows = parseCsv(text.trim())
  if (rows.length === 0) {
    throw new Error('Unrecognized CSV — expected a Garmin weight or activities export')
  }

  const headers = rows[0]
  const dataRows = rows.slice(1)
  const headerLower = headers.map((h) => h.trim().toLowerCase())

  const isActivities = headerLower.some((h) => h.includes('activity type') || h.includes('title'))
  const isWeight = headerLower.some((h) => h.includes('weight') && !h.includes('goal'))

  if (isActivities) {
    const sessions = parseActivitiesCsv(headers, dataRows)
    if (sessions.length === 0) {
      throw new Error('Unrecognized CSV — expected a Garmin weight or activities export')
    }
    return { weights: [], sessions, source: 'garmin-csv' }
  }

  if (isWeight) {
    const weights = parseWeightCsv(headers, dataRows)
    if (weights.length === 0) {
      throw new Error('Unrecognized CSV — expected a Garmin weight or activities export')
    }
    return { weights, sessions: [], source: 'garmin-csv' }
  }

  throw new Error('Unrecognized CSV — expected a Garmin weight or activities export')
}

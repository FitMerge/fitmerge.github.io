// Parser for an Apple Health "Export All Health Data" export (export.zip → export.xml).
//
// Apple Health exports can be 50-200MB+ of XML. We deliberately avoid parsing the whole
// document with DOMParser (which would allocate a full DOM tree and can stall or OOM the
// tab). Instead we scan the raw text in fixed-size, slightly overlapping chunks and pull
// out just the attributes we need with small, targeted regexes.

import type { BodyEntry } from '../../types'
import type { HealthImportResult, ImportedSessionInput } from './types'

const CHUNK_SIZE = 4 * 1024 * 1024 // 4MB
// Generous vs. the longest single <Record .../> or <Workout ...> opening tag we'll see, so a
// tag split across a chunk boundary is always fully present in the next chunk's overlap.
const OVERLAP = 8 * 1024

const RECORD_BODY_MASS_RE = /<Record\b[^>]*?\btype="HKQuantityTypeIdentifierBodyMass"[^>]*?\/>/g
const RECORD_BODY_FAT_RE = /<Record\b[^>]*?\btype="HKQuantityTypeIdentifierBodyFatPercentage"[^>]*?\/>/g
const WORKOUT_RE = /<Workout\b[^>]*?>/g

function attr(tag: string, name: string): string | undefined {
  const m = tag.match(new RegExp(`\\b${name}="([^"]*)"`))
  return m ? m[1] : undefined
}

function datePart(startDate: string | undefined): string | undefined {
  if (!startDate || startDate.length < 10) return undefined
  const d = startDate.slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : undefined
}

function humanizeActivityType(raw: string | undefined): string {
  const stripped = (raw ?? '').replace(/^HKWorkoutActivityType/, '') || 'Workout'
  return stripped.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
}

function durationToMinutes(value: string | undefined, unit: string | undefined): number | undefined {
  const n = value !== undefined ? Number(value) : NaN
  if (!Number.isFinite(n)) return undefined
  const u = (unit ?? 'min').toLowerCase()
  if (u.startsWith('sec')) return n / 60
  if (u.startsWith('hr') || u.startsWith('hour')) return n * 60
  return n // assume minutes
}

/** Scans a full Apple Health export.xml text and extracts body-weight, body-fat, and workout records. */
export function parseAppleHealthXml(
  xmlText: string,
  onProgress?: (pct: number) => void,
): HealthImportResult {
  const weightsByDate = new Map<string, BodyEntry>()
  const fatPctByDate = new Map<string, number>()
  const sessions: ImportedSessionInput[] = []
  const seenTags = new Set<string>()

  const total = xmlText.length
  let offset = 0

  while (offset < total) {
    const end = Math.min(offset + CHUNK_SIZE, total)
    // Extend the slice a bit past `end` so a tag straddling the boundary is fully captured;
    // duplicate matches from the overlapped tail are filtered via `seenTags`.
    const sliceEnd = Math.min(end + OVERLAP, total)
    const chunk = xmlText.slice(offset, sliceEnd)

    for (const match of chunk.matchAll(RECORD_BODY_MASS_RE)) {
      const tag = match[0]
      if (seenTags.has(tag)) continue
      seenTags.add(tag)

      const date = datePart(attr(tag, 'startDate'))
      const rawValue = attr(tag, 'value')
      const value = rawValue !== undefined ? Number(rawValue) : NaN
      if (!date || !Number.isFinite(value) || value <= 0) continue

      const unit = (attr(tag, 'unit') ?? 'kg').toLowerCase()
      const weightKg = unit === 'lb' || unit === 'lbs' ? value / 2.20462 : value
      weightsByDate.set(date, { date, weightKg })
    }

    for (const match of chunk.matchAll(RECORD_BODY_FAT_RE)) {
      const tag = match[0]
      if (seenTags.has(tag)) continue
      seenTags.add(tag)

      const date = datePart(attr(tag, 'startDate'))
      const rawValue = attr(tag, 'value')
      const value = rawValue !== undefined ? Number(rawValue) : NaN
      if (!date || !Number.isFinite(value) || value <= 0) continue

      // Apple stores body-fat as a fraction (unit "%", value like 0.22) in most exports, but
      // some sources write it as a whole percent already (value like 22). Treat >1 as already-percent.
      const pct = value > 1 ? value : value * 100
      fatPctByDate.set(date, pct)
    }

    for (const match of chunk.matchAll(WORKOUT_RE)) {
      const tag = match[0]
      if (seenTags.has(tag)) continue
      seenTags.add(tag)

      const date = datePart(attr(tag, 'startDate'))
      if (!date) continue

      const name = humanizeActivityType(attr(tag, 'workoutActivityType'))
      const durationMin = durationToMinutes(attr(tag, 'duration'), attr(tag, 'durationUnit'))
      const rawKcal = attr(tag, 'totalEnergyBurned')
      const kcal = rawKcal !== undefined ? Number(rawKcal) : undefined

      const session: ImportedSessionInput = { name, date }
      if (durationMin !== undefined && durationMin >= 0) session.durationMin = durationMin
      if (kcal !== undefined && Number.isFinite(kcal) && kcal >= 0) session.kcal = kcal
      sessions.push(session)
    }

    offset = end
    onProgress?.(Math.round((offset / total) * 100))
  }

  const weights = Array.from(weightsByDate.values()).map((entry) => {
    const bodyFatPct = fatPctByDate.get(entry.date)
    return bodyFatPct !== undefined ? { ...entry, bodyFatPct } : entry
  })

  return { weights, sessions, health: [], source: 'apple-health' }
}

/** Pulls the export.xml text out of an already-in-memory Apple Health zip buffer. */
export async function readAppleExportXml(buf: Uint8Array): Promise<string> {
  const { unzipSync } = await import('fflate')
  const entries = unzipSync(buf, { filter: (entry) => entry.name.endsWith('export.xml') })

  const preferredName = 'apple_health_export/export.xml'
  const entryName = entries[preferredName]
    ? preferredName
    : Object.keys(entries).find((name) => name.endsWith('export.xml'))

  if (!entryName) {
    throw new Error('No export.xml found in this zip')
  }
  return new TextDecoder('utf-8').decode(entries[entryName])
}

/** Reads an Apple Health export (export.zip, export.xml, or plain text) and parses it. */
export async function parseAppleHealthFile(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<HealthImportResult> {
  let isZip = file.name.toLowerCase().endsWith('.zip')
  if (!isZip) {
    const head = new Uint8Array(await file.slice(0, 2).arrayBuffer())
    isZip = head[0] === 0x50 && head[1] === 0x4b // 'PK'
  }

  if (!isZip) {
    const text = await file.text()
    return parseAppleHealthXml(text, onProgress)
  }

  const buf = new Uint8Array(await file.arrayBuffer())
  return parseAppleHealthXml(await readAppleExportXml(buf), onProgress)
}

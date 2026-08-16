// Parser for a Fitbit "Google Takeout" export. Fitbit is Google-account-only now, so the
// way a user gets their data out is takeout.google.com → select "Fitbit" → download a zip
// of many small JSON files (plus a CSV or two). Folder names vary by region and export
// vintage, so we route by FILE BASENAME, not by directory — a `weight-*.json` is a weight
// file whether it sits under "Global Export Data" or anywhere else.
//
// Deliberately narrow: we decompress only the files we can use (weight, sleep, sleep
// score, resting heart rate, steps, exercise) and skip the huge minute-level intraday
// files for heart rate, calories and distance that would blow up memory for no gain here.
//
// UNIT ASSUMPTION: Fitbit's Takeout weight files carry NO unit — the value is just a
// number in whatever the account was set to. There is no reliable disambiguator in the
// file (bmi doesn't help without height), so we assume POUNDS, which is the US default and
// by far the common case. A metric user's weights would import 2.2× too small; that's
// called out in the UI copy.

import type { BodyEntry, HealthDay } from '../../types'
import type { HealthImportResult, ImportedSessionInput } from './types'

const LB_TO_KG = 1 / 2.20462

// Basename prefixes we handle. Everything else in the zip is ignored (never decompressed).
const WEIGHT_RE = /^weight-.*\.json$/i
const SLEEP_RE = /^sleep-.*\.json$/i
const SLEEP_SCORE_RE = /^sleep_score\.csv$/i
const RESTING_HR_RE = /^resting_heart_rate-.*\.json$/i
const STEPS_RE = /^steps-.*\.json$/i
const EXERCISE_RE = /^exercise-.*\.json$/i

function baseName(path: string): string {
  const i = path.lastIndexOf('/')
  return i >= 0 ? path.slice(i + 1) : path
}

function isFitbitFile(name: string): boolean {
  const b = baseName(name)
  return (
    WEIGHT_RE.test(b) ||
    SLEEP_RE.test(b) ||
    SLEEP_SCORE_RE.test(b) ||
    RESTING_HR_RE.test(b) ||
    STEPS_RE.test(b) ||
    EXERCISE_RE.test(b)
  )
}

/** True if a zip's entry names look like a Fitbit Takeout export. */
export function isFitbitExport(names: string[]): boolean {
  // A "Fitbit/" path segment is the strongest signal; fall back to recognising our
  // known data files so a re-zipped subset still imports.
  return names.some((n) => /(^|\/)fitbit\//i.test(n)) || names.some(isFitbitFile)
}

/** A finite number from a Fitbit field, which is often a numeric STRING like "8452". */
function num(v: unknown): number | undefined {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
  return Number.isFinite(n) ? n : undefined
}

/** Fitbit dates come as ISO ("2025-07-12", "2025-07-11T23:30:00.000") or US "M/D/YY HH:MM:SS". */
export function fitbitDateToIso(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined
  const t = raw.trim()
  if (!t) return undefined

  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`

  const us = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/)
  if (us) {
    const month = String(Number(us[1])).padStart(2, '0')
    const day = String(Number(us[2])).padStart(2, '0')
    const year = us[3].length === 2 ? 2000 + Number(us[3]) : Number(us[3])
    if (Number(month) < 1 || Number(month) > 12 || Number(day) < 1 || Number(day) > 31) return undefined
    return `${year}-${month}-${day}`
  }
  return undefined
}

/** "HH:MM" from an ISO datetime or a US "M/D/YY HH:MM:SS", for ordering same-day sessions. */
function timeOfDay(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined
  const iso = raw.match(/T(\d{2}):(\d{2})/)
  if (iso) return `${iso[1]}:${iso[2]}`
  const us = raw.match(/\d{1,2}\/\d{1,2}\/\d{2,4}\s+(\d{1,2}):(\d{2})/)
  if (us) return `${us[1].padStart(2, '0')}:${us[2]}`
  return undefined
}

/** Whether a Fitbit dateTime carries a clock time (intraday sample) or is a date-only daily total. */
function hasClockTime(raw: unknown): boolean {
  return typeof raw === 'string' && (/T\d{2}:\d{2}/.test(raw) || /\d{1,2}:\d{2}/.test(raw.replace(/^\S+/, '')))
}

function asArray(parsed: unknown): unknown[] {
  return Array.isArray(parsed) ? parsed : []
}

// --- accumulator -------------------------------------------------------------

type Acc = {
  weights: Map<string, BodyEntry>
  /** date -> partial metrics, merged across sleep / RHR / steps / score files. */
  health: Map<string, Record<string, number>>
  /** date -> summed intraday step count. */
  stepsIntraday: Map<string, number>
  /** date -> daily-total step count (authoritative over the intraday sum). */
  stepsDaily: Map<string, number>
  sessions: ImportedSessionInput[]
}

function newAcc(): Acc {
  return {
    weights: new Map(),
    health: new Map(),
    stepsIntraday: new Map(),
    stepsDaily: new Map(),
    sessions: [],
  }
}

function metricsFor(acc: Acc, date: string): Record<string, number> {
  let m = acc.health.get(date)
  if (!m) {
    m = {}
    acc.health.set(date, m)
  }
  return m
}

function ingestWeight(acc: Acc, rows: unknown[]): void {
  for (const row of rows) {
    if (typeof row !== 'object' || row === null) continue
    const r = row as Record<string, unknown>
    const date = fitbitDateToIso(r.date ?? r.dateTime)
    const value = num(r.weight)
    if (!date || value === undefined || value <= 0) continue
    // Last write per date wins — Takeout lists chronologically, so this keeps the latest.
    const entry: BodyEntry = { date, weightKg: value * LB_TO_KG }
    const fat = num(r.fat)
    if (fat !== undefined && fat > 0) entry.bodyFatPct = fat
    acc.weights.set(date, entry)
  }
}

function ingestSleep(acc: Acc, rows: unknown[]): void {
  for (const row of rows) {
    if (typeof row !== 'object' || row === null) continue
    const r = row as Record<string, unknown>
    const date = fitbitDateToIso(r.dateOfSleep ?? r.startTime)
    if (!date) continue
    const m = metricsFor(acc, date)

    const asleep = num(r.minutesAsleep)
    if (asleep !== undefined && asleep > 0) m.sleepMinutes = asleep

    const summary =
      typeof r.levels === 'object' && r.levels !== null
        ? (r.levels as Record<string, unknown>).summary
        : undefined
    if (typeof summary === 'object' && summary !== null) {
      const s = summary as Record<string, unknown>
      const stage = (key: string): number | undefined => {
        const node = s[key]
        return typeof node === 'object' && node !== null
          ? num((node as Record<string, unknown>).minutes)
          : undefined
      }
      const deep = stage('deep')
      const rem = stage('rem')
      const light = stage('light')
      const wake = stage('wake')
      if (deep !== undefined) m.deepSleepMinutes = deep
      if (rem !== undefined) m.remSleepMinutes = rem
      if (light !== undefined) m.lightSleepMinutes = light
      if (wake !== undefined) m.awakeMinutes = wake
    }
    if (m.awakeMinutes === undefined) {
      const awake = num(r.minutesAwake)
      if (awake !== undefined && awake > 0) m.awakeMinutes = awake
    }
    const efficiency = num(r.efficiency)
    if (efficiency !== undefined && efficiency > 0) m.sleepEfficiency = efficiency
  }
}

function ingestRestingHr(acc: Acc, rows: unknown[]): void {
  for (const row of rows) {
    if (typeof row !== 'object' || row === null) continue
    const r = row as Record<string, unknown>
    const date = fitbitDateToIso(r.dateTime ?? r.date)
    if (!date) continue
    // Shape is { dateTime, value: { value: 58.5, error, date } }; tolerate a flat value too.
    const nested = typeof r.value === 'object' && r.value !== null ? (r.value as Record<string, unknown>).value : r.value
    const bpm = num(nested)
    if (bpm === undefined || bpm <= 0) continue
    metricsFor(acc, date).restingHr = Math.round(bpm)
  }
}

function ingestSteps(acc: Acc, rows: unknown[]): void {
  for (const row of rows) {
    if (typeof row !== 'object' || row === null) continue
    const r = row as Record<string, unknown>
    const date = fitbitDateToIso(r.dateTime ?? r.date)
    const value = num(r.value)
    if (!date || value === undefined) continue
    if (hasClockTime(r.dateTime)) {
      acc.stepsIntraday.set(date, (acc.stepsIntraday.get(date) ?? 0) + value)
    } else {
      acc.stepsDaily.set(date, value)
    }
  }
}

function ingestExercise(acc: Acc, rows: unknown[]): void {
  for (const row of rows) {
    if (typeof row !== 'object' || row === null) continue
    const r = row as Record<string, unknown>
    const date = fitbitDateToIso(r.startTime ?? r.dateTime ?? r.date)
    if (!date) continue
    const name = typeof r.activityName === 'string' && r.activityName.trim() ? r.activityName.trim() : 'Activity'

    const durationMs = num(r.duration) ?? num(r.activeDuration)
    const durationMin = durationMs !== undefined ? durationMs / 60000 : undefined
    const kcal = num(r.calories)
    const avgHr = num(r.averageHeartRate)

    // Skip a bare marker with nothing measured — it would be a name and a date only.
    if ((durationMin === undefined || durationMin <= 0) && (kcal === undefined || kcal <= 0)) continue

    const session: ImportedSessionInput = { name, date }
    if (durationMin !== undefined && durationMin > 0) session.durationMin = durationMin
    if (kcal !== undefined && kcal > 0) session.kcal = kcal
    if (avgHr !== undefined && avgHr >= 1) session.avgHr = avgHr
    const start = timeOfDay(r.startTime)
    if (start) session.startTime = start
    acc.sessions.push(session)
  }
}

/** Minimal CSV split for sleep_score.csv (no quoted fields in Fitbit's own export). */
function ingestSleepScoreCsv(acc: Acc, text: string): void {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase())
  const tsIdx = headers.findIndex((h) => h.includes('timestamp'))
  const scoreIdx = headers.findIndex((h) => h === 'overall_score' || h.includes('overall'))
  if (tsIdx < 0 || scoreIdx < 0) return
  for (const line of lines.slice(1)) {
    const cols = line.split(',')
    const date = fitbitDateToIso(cols[tsIdx])
    const score = num(cols[scoreIdx])
    if (!date || score === undefined || score <= 0) continue
    metricsFor(acc, date).sleepScore = Math.round(score)
  }
}

function dispatch(acc: Acc, name: string, bytes: Uint8Array): void {
  const b = baseName(name)
  const text = new TextDecoder('utf-8').decode(bytes)

  if (SLEEP_SCORE_RE.test(b)) {
    ingestSleepScoreCsv(acc, text)
    return
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return // a malformed file shouldn't sink the whole import
  }
  const rows = asArray(parsed)
  if (WEIGHT_RE.test(b)) ingestWeight(acc, rows)
  else if (SLEEP_RE.test(b)) ingestSleep(acc, rows)
  else if (RESTING_HR_RE.test(b)) ingestRestingHr(acc, rows)
  else if (STEPS_RE.test(b)) ingestSteps(acc, rows)
  else if (EXERCISE_RE.test(b)) ingestExercise(acc, rows)
}

function assemble(acc: Acc): HealthImportResult {
  // Fold step counts in: a date-only daily total is authoritative over a summed
  // intraday series for the same day.
  const stepDates = new Set([...acc.stepsDaily.keys(), ...acc.stepsIntraday.keys()])
  for (const date of stepDates) {
    const steps = acc.stepsDaily.get(date) ?? acc.stepsIntraday.get(date)
    if (steps !== undefined && steps > 0) metricsFor(acc, date).steps = Math.round(steps)
  }

  const health: HealthDay[] = []
  for (const [date, metrics] of acc.health) {
    if (Object.keys(metrics).length > 0) health.push({ date, metrics })
  }

  return {
    weights: Array.from(acc.weights.values()),
    sessions: acc.sessions,
    health,
    source: 'fitbit',
  }
}

/** Parse a Fitbit Google Takeout zip (already read into memory). */
export async function parseFitbitZip(
  buf: Uint8Array,
  onProgress?: (pct: number) => void,
): Promise<HealthImportResult> {
  const { unzipSync } = await import('fflate')
  // Decompress ONLY the files we handle — skips the heavy intraday heart-rate/calorie files.
  const entries = unzipSync(buf, { filter: (f) => isFitbitFile(f.name) })

  const acc = newAcc()
  const names = Object.keys(entries)
  let done = 0
  for (const name of names) {
    dispatch(acc, name, entries[name])
    done += 1
    onProgress?.(Math.round((done / names.length) * 100))
  }

  const result = assemble(acc)
  if (result.weights.length === 0 && result.sessions.length === 0 && result.health.length === 0) {
    throw new Error('No Fitbit weight, sleep, steps or activity data found in that export')
  }
  return result
}

/**
 * Parse a single Fitbit JSON file (a user who extracted one file rather than importing the
 * whole zip). Sniffs the array's first element to tell which kind it is.
 */
export function parseFitbitJson(text: string): HealthImportResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Not a Fitbit export file')
  }
  const rows = asArray(parsed)
  const first = rows.find((r) => typeof r === 'object' && r !== null) as Record<string, unknown> | undefined
  if (!first) throw new Error('Not a Fitbit export file')

  const acc = newAcc()
  if ('weight' in first) ingestWeight(acc, rows)
  else if ('activityName' in first) ingestExercise(acc, rows)
  else if ('dateOfSleep' in first || 'minutesAsleep' in first || 'levels' in first) ingestSleep(acc, rows)
  else if ('dateTime' in first && 'value' in first) {
    // Resting-HR rows nest { value: { value } }; step rows carry a scalar value.
    const v = first.value
    if (typeof v === 'object' && v !== null) ingestRestingHr(acc, rows)
    else ingestSteps(acc, rows)
  } else {
    throw new Error('Not a Fitbit export file')
  }

  const result = assemble(acc)
  if (result.weights.length === 0 && result.sessions.length === 0 && result.health.length === 0) {
    throw new Error('Not a Fitbit export file')
  }
  return result
}

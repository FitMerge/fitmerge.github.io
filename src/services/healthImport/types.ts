// Shared types for the Health Data Connect importers (Apple Health, Garmin CSV, FitMerge JSON).

/** A workout parsed from an external source, not yet turned into a WorkoutSession.
 *
 * Everything past `date` mirrors the optional detail on WorkoutSession, so an
 * import carries through whatever the source measured rather than flattening a
 * rich Garmin activity down to a name and a duration. */
export type ImportedSessionInput = {
  name: string
  date: string
  durationMin?: number
  kcal?: number
  trainingLoad?: number
  distanceKm?: number
  sportType?: string
  avgHr?: number
  maxHr?: number
  elevationGainM?: number
  avgCadence?: number
  aerobicTe?: number
  anaerobicTe?: number
  avgPower?: number
  startTime?: string
  garminActivityId?: string
}

/** Numeric detail fields, with the smallest value that counts as a real reading.
 * Garmin writes an unmeasured heart rate as 0; storing that would read as a
 * measurement and drag averages down, so anything below the floor is dropped. */
export const NUMERIC_SESSION_FIELDS: [keyof ImportedSessionInput, number][] = [
  ['durationMin', 0],
  ['kcal', 0],
  ['trainingLoad', 0],
  ['distanceKm', 0.0001],
  ['avgHr', 1],
  ['maxHr', 1],
  ['elevationGainM', 0.5],
  ['avgCadence', 1],
  ['aerobicTe', 0.1],
  ['anaerobicTe', 0.1],
  ['avgPower', 1],
]

export const STRING_SESSION_FIELDS: (keyof ImportedSessionInput)[] = [
  'sportType',
  'startTime',
  'garminActivityId',
]

export type HealthImportSource = 'fitmerge-json' | 'apple-health' | 'garmin-csv'

export type HealthImportResult = {
  weights: import('../../types').BodyEntry[]
  sessions: ImportedSessionInput[]
  health: import('../../types').HealthDay[]
  source: HealthImportSource
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function coerceFiniteNumber(value: unknown): number | undefined {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : undefined
}

/** Human label for a source, used in the import preview line. */
export function sourceLabel(source: HealthImportSource): string {
  if (source === 'apple-health') return 'Apple Health'
  if (source === 'garmin-csv') return 'Garmin'
  return 'FitMerge JSON'
}

// Shared types for the Health Data Connect importers (Apple Health, Garmin CSV, FitMerge JSON).

/** A workout parsed from an external source, not yet turned into a WorkoutSession. */
export type ImportedSessionInput = {
  name: string
  date: string
  durationMin?: number
  kcal?: number
}

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

import { useState } from 'react'
import { useBodyStore } from '../../store/body'
import { useWorkoutsStore } from '../../store/workouts'
import { useHealthStore } from '../../store/health'
import { detectAndParse } from '../../services/healthImport'
import type { HealthImportResult } from '../../services/healthImport'

export type ImportStage = 'idle' | 'parsing' | 'preview' | 'error'
export type ImportSuccess = { weights: number; sessions: number; health: number }

/**
 * The file → parse → preview → commit flow for Health Data Connect, shared by the
 * Settings panel and the quick-add sheet so there's a single implementation of the
 * parsing and the three batched store writes.
 */
export function useHealthImport() {
  const bulkUpsertEntries = useBodyStore((s) => s.bulkUpsertEntries)
  const addImportedSessions = useWorkoutsStore((s) => s.addImportedSessions)
  const bulkUpsertDays = useHealthStore((s) => s.bulkUpsertDays)

  const [stage, setStage] = useState<ImportStage>('idle')
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<HealthImportResult | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState<ImportSuccess | null>(null)

  async function parseFile(file: File) {
    setSuccess(null)
    setError('')
    setProgress(0)
    setStage('parsing')
    try {
      const parsed = await detectAndParse(file, (pct) => setProgress(pct))
      if (parsed.weights.length === 0 && parsed.sessions.length === 0 && parsed.health.length === 0) {
        setError('No weigh-ins, workouts, or health metrics found in that file.')
        setStage('error')
        return
      }
      setResult(parsed)
      setStage('preview')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that file')
      setStage('error')
    }
  }

  function confirmImport() {
    if (!result) return
    // Three batched writes (one per store) instead of one per record — importing
    // years of data is otherwise O(n²) over localStorage and freezes mid-import.
    bulkUpsertEntries(result.weights)
    const importedSessions = addImportedSessions(
      result.sessions.map((session) => {
        const startedAt = Date.parse(`${session.date}T${session.startTime ?? '12:00'}:00`)
        return {
          ...session,
          startedAt,
          finishedAt: startedAt + (session.durationMin ?? 0) * 60000,
          entries: [],
          imported: true as const,
        }
      }),
    )
    bulkUpsertDays(result.health)
    setSuccess({ weights: result.weights.length, sessions: importedSessions, health: result.health.length })
    setResult(null)
    setStage('idle')
  }

  function cancel() {
    setResult(null)
    setStage('idle')
  }

  function reset() {
    setStage('idle')
    setResult(null)
    setError('')
    setSuccess(null)
    setProgress(0)
  }

  return { stage, progress, result, error, success, parseFile, confirmImport, cancel, reset }
}

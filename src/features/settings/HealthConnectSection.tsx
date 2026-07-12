import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { ChevronDown, ChevronUp, Loader2, UploadCloud } from 'lucide-react'
import Card from '../../components/Card'
import Button from '../../components/Button'
import { useBodyStore } from '../../store/body'
import { useWorkoutsStore } from '../../store/workouts'
import { detectAndParse, sourceLabel } from '../../services/healthImport'
import type { HealthImportResult } from '../../services/healthImport'

type Stage = 'idle' | 'parsing' | 'preview' | 'error'

type SuccessSummary = { weights: number; sessions: number }

export default function HealthConnectSection() {
  const upsertEntry = useBodyStore((s) => s.upsertEntry)
  const addSession = useWorkoutsStore((s) => s.addSession)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const [stage, setStage] = useState<Stage>('idle')
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<HealthImportResult | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [success, setSuccess] = useState<SuccessSummary | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)

  function openPicker() {
    setSuccess(null)
    fileInputRef.current?.click()
  }

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setSuccess(null)
    setErrorMessage('')
    setProgress(0)
    setStage('parsing')

    try {
      const parsed = await detectAndParse(file, (pct) => setProgress(pct))
      if (parsed.weights.length === 0 && parsed.sessions.length === 0) {
        setErrorMessage('No weigh-ins or workouts found in that file.')
        setStage('error')
        return
      }
      setResult(parsed)
      setStage('preview')
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Could not read that file')
      setStage('error')
    }
  }

  function handleCancelPreview() {
    setResult(null)
    setStage('idle')
  }

  function handleImport() {
    if (!result) return

    for (const weight of result.weights) {
      upsertEntry(weight)
    }

    const existing = useWorkoutsStore.getState().sessions
    const seenKeys = new Set(
      existing.filter((s) => s.imported).map((s) => `${s.date}::${s.name}`),
    )

    let importedSessions = 0
    for (const session of result.sessions) {
      const key = `${session.date}::${session.name}`
      if (seenKeys.has(key)) continue
      seenKeys.add(key)

      const startedAt = Date.parse(`${session.date}T12:00:00`)
      const finishedAt = startedAt + (session.durationMin ?? 0) * 60000
      addSession({
        name: session.name,
        date: session.date,
        startedAt,
        finishedAt,
        entries: [],
        imported: true,
        durationMin: session.durationMin,
        kcal: session.kcal,
      })
      importedSessions++
    }

    setSuccess({ weights: result.weights.length, sessions: importedSessions })
    setResult(null)
    setStage('idle')
  }

  return (
    <Card className="space-y-3">
      <h2 className="text-sm font-semibold text-slate-200">Connect health data</h2>
      <p className="text-sm text-slate-400">
        Import weight and workouts from Apple Health, Garmin, or a FitMerge JSON file.
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.xml,.zip,.csv"
        onChange={handleFileChange}
        className="hidden"
      />

      {stage === 'idle' && (
        <Button variant="primary" full onClick={openPicker}>
          <span className="flex items-center justify-center gap-1.5">
            <UploadCloud size={16} />
            Import file
          </span>
        </Button>
      )}

      {stage === 'parsing' && (
        <div className="flex items-center justify-center gap-2 rounded-xl bg-slate-800/60 py-3 text-sm text-slate-300">
          <Loader2 size={16} className="animate-spin" />
          Reading… {progress}%
        </div>
      )}

      {stage === 'preview' && result && (
        <div className="space-y-3">
          <div className="rounded-xl bg-slate-800/60 p-3 text-sm text-slate-200">
            Found {result.weights.length} weigh-in{result.weights.length === 1 ? '' : 's'} ·{' '}
            {result.sessions.length} workout{result.sessions.length === 1 ? '' : 's'} from{' '}
            {sourceLabel(result.source)}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="ghost" full onClick={handleCancelPreview}>
              Cancel
            </Button>
            <Button variant="primary" full onClick={handleImport}>
              Import
            </Button>
          </div>
        </div>
      )}

      {stage === 'error' && (
        <div className="space-y-2">
          <p className="text-sm text-red-400">{errorMessage}</p>
          <Button variant="ghost" full onClick={() => setStage('idle')}>
            Try again
          </Button>
        </div>
      )}

      {success && (
        <p className="text-sm text-emerald-400">
          Imported {success.weights} weigh-in{success.weights === 1 ? '' : 's'} · {success.sessions} workout
          {success.sessions === 1 ? '' : 's'}
        </p>
      )}

      <button
        type="button"
        onClick={() => setHelpOpen((v) => !v)}
        className="flex w-full items-center justify-between text-sm text-slate-400"
      >
        <span>How to connect</span>
        {helpOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {helpOpen && (
        <div className="space-y-3 text-xs text-slate-400">
          <div>
            <p className="font-semibold text-slate-300">1. Apple Health</p>
            <p>Health app → tap your profile picture → Export All Health Data → import the resulting export.zip here.</p>
          </div>
          <div>
            <p className="font-semibold text-slate-300">2. Garmin</p>
            <p>
              Connect website → export your weight or activities CSV, or run{' '}
              <code className="rounded bg-slate-800 px-1 py-0.5">scripts/garmin-sync.py</code> (see README) to
              generate a FitMerge JSON file directly.
            </p>
          </div>
          <div>
            <p className="font-semibold text-slate-300">3. Claude / MCP</p>
            <p>
              Connect a Garmin MCP server to Claude and ask it to produce a FitMerge JSON file, then import it
              here.
            </p>
          </div>
        </div>
      )}
    </Card>
  )
}

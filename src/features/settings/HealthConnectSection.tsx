import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { ChevronDown, ChevronUp, Loader2, UploadCloud } from 'lucide-react'
import Card from '../../components/Card'
import Button from '../../components/Button'
import { useBodyStore } from '../../store/body'
import { useWorkoutsStore } from '../../store/workouts'
import { useHealthStore } from '../../store/health'
import { useSettingsStore, type TrackingSource } from '../../store/settings'
import { sourceLabel } from '../../services/healthImport'
import { useHealthImport } from './useHealthImport'

const SOURCE_CHOICES: { key: TrackingSource; label: string }[] = [
  { key: 'garmin', label: 'Garmin' },
  { key: 'apple', label: 'Apple' },
  { key: 'other', label: 'Other' },
  { key: 'manual', label: 'No watch' },
]

export default function HealthConnectSection() {
  const trackingSource = useSettingsStore((s) => s.trackingSource)
  const setTrackingSource = useSettingsStore((s) => s.setTrackingSource)

  // Live counts of what's actually persisted on THIS device — the ground truth for
  // "did my import land?" (independent of any cloud sync state).
  const storedWeights = useBodyStore((s) => s.entries.length)
  const storedSessions = useWorkoutsStore((s) => s.sessions.length)
  const storedHealthDays = useHealthStore((s) => Object.keys(s.days).length)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const { stage, progress, result, error: errorMessage, success, parseFile, confirmImport, cancel, reset } =
    useHealthImport()
  const [helpOpen, setHelpOpen] = useState(false)

  function openPicker() {
    reset()
    fileInputRef.current?.click()
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) void parseFile(file)
  }

  const handleCancelPreview = cancel
  const handleImport = confirmImport

  return (
    <Card className="space-y-3">
      <h2 className="text-sm font-semibold text-slate-200">Connect health data</h2>
      <p className="text-sm text-slate-400">
        Import weight and workouts from Apple Health, Garmin, Fitbit, or a FitMerge JSON file.
      </p>

      {/* Chosen during onboarding; changeable here so the app keeps shaping itself
          to the right gear (which quick-log tiles appear, what empty states say). */}
      <div className="space-y-1.5">
        <p className="text-xs text-slate-400">How I track</p>
        <div className="grid grid-cols-4 gap-1.5">
          {SOURCE_CHOICES.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setTrackingSource(opt.key)}
              className={`rounded-lg py-1.5 text-[11px] font-medium ${
                trackingSource === opt.key ? 'bg-primary-500 text-slate-950' : 'bg-slate-800 text-slate-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {(storedWeights > 0 || storedSessions > 0 || storedHealthDays > 0) && (
        <div className="rounded-lg bg-slate-800/60 px-3 py-2 text-xs text-slate-300">
          <span className="text-slate-500">On this device: </span>
          {storedWeights.toLocaleString()} weigh-ins · {storedSessions.toLocaleString()} activities ·{' '}
          <span className={storedHealthDays > 0 ? 'text-emerald-400' : 'text-amber-400'}>
            {storedHealthDays.toLocaleString()} days of health metrics
          </span>
        </div>
      )}

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
            {result.sessions.length} workout{result.sessions.length === 1 ? '' : 's'} ·{' '}
            {result.health.length} day{result.health.length === 1 ? '' : 's'} of metrics from{' '}
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
          <Button variant="ghost" full onClick={reset}>
            Try again
          </Button>
        </div>
      )}

      {success && (
        <p className="text-sm text-emerald-400">
          Imported {success.weights} weigh-in{success.weights === 1 ? '' : 's'} · {success.sessions} workout
          {success.sessions === 1 ? '' : 's'} · {success.health} day{success.health === 1 ? '' : 's'} of metrics
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
            <p className="font-semibold text-slate-300">2. Fitbit</p>
            <p>
              Go to <code className="rounded bg-slate-800 px-1 py-0.5">takeout.google.com</code>, deselect all, pick
              only <span className="text-slate-300">Fitbit</span>, and create the export. Import the resulting zip
              here. Brings across weight, sleep, steps, resting heart rate and activities (Yoga, spinning, etc.).
              Weight is read as pounds — the Fitbit export doesn&apos;t record the unit, so tell me if hers is set to
              kg.
            </p>
          </div>
          <div>
            <p className="font-semibold text-slate-300">3. Garmin</p>
            <p>
              Connect website → export your weight or activities CSV, or run{' '}
              <code className="rounded bg-slate-800 px-1 py-0.5">scripts/garmin-sync.py</code> (see README) to
              generate a FitMerge JSON file directly.
            </p>
          </div>
          <div>
            <p className="font-semibold text-slate-300">4. Claude / MCP</p>
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

import { useRef, useState } from 'react'
import { Download, Upload, RotateCcw } from 'lucide-react'
import Card from '../../components/Card'
import Button from '../../components/Button'
import Sheet from '../../components/Sheet'
import { useNutritionStore } from '../../store/nutrition'
import { useWorkoutsStore } from '../../store/workouts'
import { useBodyStore } from '../../store/body'
import { useSettingsStore } from '../../store/settings'
import { applyBackup, parseBackup, type ParsedBackup } from '../../services/dataBackup'

export default function DataSection() {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<ParsedBackup | null>(null)
  const [importError, setImportError] = useState('')
  const [imported, setImported] = useState(false)

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file
    if (!file) return
    setImportError('')
    setImported(false)
    const text = await file.text()
    const parsed = parseBackup(text)
    if (!parsed) {
      setImportError("That doesn't look like a FitMerge export file.")
      return
    }
    setPreview(parsed)
  }

  function handleApplyImport() {
    if (!preview) return
    applyBackup(preview.raw)
    setPreview(null)
    setImported(true)
  }

  function handleExport() {
    const nutrition = useNutritionStore.getState()
    const workouts = useWorkoutsStore.getState()
    const body = useBodyStore.getState()
    const settings = useSettingsStore.getState()

    const payload = {
      exportedAt: new Date().toISOString(),
      nutrition: {
        entries: nutrition.entries,
        customFoods: nutrition.customFoods,
        savedMeals: nutrition.savedMeals,
        water: nutrition.water,
      },
      workouts: { routines: workouts.routines, sessions: workouts.sessions },
      body: { entries: body.entries },
      settings: {
        goals: settings.goals,
        units: settings.units,
        profile: settings.profile,
        waterGoalMl: settings.waterGoalMl,
      },
    }

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'fitmerge-export.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleReset() {
    // Clears logged data only (as the confirm copy states) — the user's
    // preferences (units, goals, profile, Gemini key) are intentionally kept,
    // so a reset never silently flips units or wipes their setup.
    useNutritionStore.setState({ entries: [], customFoods: [], savedMeals: [], water: {} })
    useWorkoutsStore.setState({ routines: [], sessions: [], activeSessionId: undefined })
    useBodyStore.setState({ entries: [] })
    setConfirmOpen(false)
  }

  return (
    <Card className="space-y-3">
      <h2 className="text-sm font-semibold text-slate-200">Data</h2>

      <Button variant="ghost" full onClick={handleExport}>
        <span className="flex items-center justify-center gap-1.5">
          <Download size={16} />
          Export data
        </span>
      </Button>

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={handleImportFile}
      />
      <Button variant="ghost" full onClick={() => fileRef.current?.click()}>
        <span className="flex items-center justify-center gap-1.5">
          <Upload size={16} />
          Import data
        </span>
      </Button>
      {importError && <p className="text-sm text-red-400">{importError}</p>}
      {imported && <p className="text-sm text-emerald-400">Data imported.</p>}

      <Button variant="danger" full onClick={() => setConfirmOpen(true)}>
        <span className="flex items-center justify-center gap-1.5">
          <RotateCcw size={16} />
          Reset all data
        </span>
      </Button>

      <Sheet open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Reset all data?">
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            This clears all food, workout, and body-weight data on this device. Your Gemini API key is kept. This
            can&apos;t be undone.
          </p>
          <Button variant="danger" full onClick={handleReset}>
            Yes, reset everything
          </Button>
          <Button variant="ghost" full onClick={() => setConfirmOpen(false)}>
            Cancel
          </Button>
        </div>
      </Sheet>

      <Sheet open={preview !== null} onClose={() => setPreview(null)} title="Import backup?">
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            Found {preview?.summary.foods ?? 0} food entries, {preview?.summary.workouts ?? 0} workouts, and{' '}
            {preview?.summary.weighIns ?? 0} weigh-ins. This merges into your current data — nothing is
            overwritten.
          </p>
          <Button variant="primary" full onClick={handleApplyImport}>
            Import
          </Button>
          <Button variant="ghost" full onClick={() => setPreview(null)}>
            Cancel
          </Button>
        </div>
      </Sheet>
    </Card>
  )
}

import { useState } from 'react'
import { Download, RotateCcw } from 'lucide-react'
import Card from '../../components/Card'
import Button from '../../components/Button'
import Sheet from '../../components/Sheet'
import { useNutritionStore } from '../../store/nutrition'
import { useWorkoutsStore } from '../../store/workouts'
import { useBodyStore } from '../../store/body'
import { useSettingsStore } from '../../store/settings'

export default function DataSection() {
  const [confirmOpen, setConfirmOpen] = useState(false)

  function handleExport() {
    const nutrition = useNutritionStore.getState()
    const workouts = useWorkoutsStore.getState()
    const body = useBodyStore.getState()
    const settings = useSettingsStore.getState()

    const payload = {
      exportedAt: new Date().toISOString(),
      nutrition: { entries: nutrition.entries, customFoods: nutrition.customFoods },
      workouts: { routines: workouts.routines, sessions: workouts.sessions },
      body: { entries: body.entries },
      settings: { goals: settings.goals, units: settings.units, profile: settings.profile },
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
    useNutritionStore.setState({ entries: [], customFoods: [] })
    useWorkoutsStore.setState({ routines: [], sessions: [], activeSessionId: undefined })
    useBodyStore.setState({ entries: [] })
    useSettingsStore.setState({
      goals: { calories: 2200, protein: 150, carbs: 220, fat: 70 },
      units: 'metric',
      profile: { sex: 'male', activity: 'moderate' },
    })
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
    </Card>
  )
}

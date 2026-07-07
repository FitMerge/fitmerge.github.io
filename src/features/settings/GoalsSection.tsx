import { useState } from 'react'
import Card from '../../components/Card'
import Button from '../../components/Button'
import NumberField from '../../components/NumberField'
import TdeeCard from './TdeeCard'
import { useSettingsStore } from '../../store/settings'
import type { Goals } from '../../types'

export default function GoalsSection() {
  const goals = useSettingsStore((s) => s.goals)
  const setGoals = useSettingsStore((s) => s.setGoals)

  const [draft, setDraft] = useState<Goals>(goals)

  function handleSave() {
    setGoals(draft)
  }

  return (
    <Card className="space-y-4">
      <h2 className="text-sm font-semibold text-slate-200">Daily goals</h2>

      <div className="grid grid-cols-2 gap-3">
        <NumberField
          label="Calories"
          value={draft.calories}
          onChange={(calories) => setDraft((d) => ({ ...d, calories }))}
          step={50}
          min={0}
          suffix="kcal"
        />
        <NumberField
          label="Protein"
          value={draft.protein}
          onChange={(protein) => setDraft((d) => ({ ...d, protein }))}
          step={5}
          min={0}
          suffix="g"
        />
        <NumberField
          label="Carbs"
          value={draft.carbs}
          onChange={(carbs) => setDraft((d) => ({ ...d, carbs }))}
          step={5}
          min={0}
          suffix="g"
        />
        <NumberField
          label="Fat"
          value={draft.fat}
          onChange={(fat) => setDraft((d) => ({ ...d, fat }))}
          step={5}
          min={0}
          suffix="g"
        />
      </div>

      <Button variant="primary" full onClick={handleSave}>
        Save goals
      </Button>

      <TdeeCard onApply={setDraft} />
    </Card>
  )
}

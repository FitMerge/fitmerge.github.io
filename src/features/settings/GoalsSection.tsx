import { useState } from 'react'
import { Droplets } from 'lucide-react'
import Card from '../../components/Card'
import Button from '../../components/Button'
import NumberField from '../../components/NumberField'
import TdeeCard from './TdeeCard'
import WaterGoalSheet from '../nutrition/WaterGoalSheet'
import { useSettingsStore } from '../../store/settings'
import { WATER_UNITS, defaultWaterUnit } from '../../lib/units'
import type { Goals } from '../../types'

export default function GoalsSection() {
  const goals = useSettingsStore((s) => s.goals)
  const setGoals = useSettingsStore((s) => s.setGoals)
  const waterGoalMl = useSettingsStore((s) => s.waterGoalMl)
  const units = useSettingsStore((s) => s.units)

  const [draft, setDraft] = useState<Goals>(goals)
  const [waterOpen, setWaterOpen] = useState(false)

  const wu = WATER_UNITS[defaultWaterUnit(units)]

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

      <button
        type="button"
        onClick={() => setWaterOpen(true)}
        className="flex w-full items-center justify-between rounded-xl bg-slate-800/60 px-3 py-2.5 text-left active:bg-slate-800"
      >
        <span className="flex items-center gap-2 text-sm text-slate-200">
          <Droplets size={16} className="text-sky-400" /> Water goal
        </span>
        <span className="text-sm text-slate-400">
          {`${wu.fromMl(waterGoalMl).toFixed(wu.decimals)} ${wu.label}`} ›
        </span>
      </button>

      <TdeeCard onApply={setDraft} />

      <WaterGoalSheet open={waterOpen} onClose={() => setWaterOpen(false)} />
    </Card>
  )
}

import { useState } from 'react'
import Sheet from '../../components/Sheet'
import Button from '../../components/Button'
import NumberField from '../../components/NumberField'
import SegmentedControl from '../../components/SegmentedControl'
import { useSettingsStore } from '../../store/settings'
import { useBodyStore } from '../../store/body'
import { lastNEntries } from '../progress/utils'
import { GOAL_WATER_UNITS, defaultWaterUnit, gallonToMl, type GoalWaterUnit } from '../../lib/units'
import { suggestWaterGoalMl } from '../../lib/tdee'

type WaterGoalSheetProps = {
  open: boolean
  onClose: () => void
}

const UNIT_OPTIONS: { key: GoalWaterUnit; label: string }[] = [
  { key: 'oz', label: 'oz' },
  { key: 'cup', label: 'Cups' },
  { key: 'L', label: 'Liters' },
  { key: 'gal', label: 'Gallons' },
]

const DEFAULT_WEIGHT_KG = 75

export default function WaterGoalSheet({ open, onClose }: WaterGoalSheetProps) {
  const goalMl = useSettingsStore((s) => s.waterGoalMl)
  const setWaterGoalMl = useSettingsStore((s) => s.setWaterGoalMl)
  const units = useSettingsStore((s) => s.units)
  const bodyEntries = useBodyStore((s) => s.entries)

  const weightKg = lastNEntries(bodyEntries, 1)[0]?.weightKg ?? DEFAULT_WEIGHT_KG
  const suggested = suggestWaterGoalMl(weightKg)

  const [draftMl, setDraftMl] = useState(goalMl)
  const [unit, setUnit] = useState<GoalWaterUnit>(() => defaultWaterUnit(units))

  const u = GOAL_WATER_UNITS[unit]
  // Show every preset in the user's everyday unit so the numbers are comparable.
  const display = GOAL_WATER_UNITS[defaultWaterUnit(units)]
  const fmt = (ml: number) => `${display.fromMl(ml).toFixed(display.decimals)} ${display.label}`

  const presets = [
    { label: 'Suggested', ml: suggested },
    { label: '1 gallon', ml: Math.round(gallonToMl(1)) },
    { label: '2 L', ml: 2000 },
    { label: '3 L', ml: 3000 },
  ]

  function save() {
    setWaterGoalMl(Math.max(0, Math.round(draftMl)))
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title="Daily water goal">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {presets.map((p) => {
            const active = Math.round(draftMl) === Math.round(p.ml)
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => setDraftMl(p.ml)}
                className={`flex flex-col items-start rounded-xl border px-3 py-2.5 text-left ${
                  active ? 'border-sky-500 bg-sky-500/10' : 'border-slate-800 bg-slate-800/60'
                }`}
              >
                <span className="text-sm font-medium text-slate-100">{p.label}</span>
                <span className="text-xs text-slate-400">{fmt(p.ml)}</span>
              </button>
            )
          })}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-400">Or set your own</p>
          <SegmentedControl size="sm" options={UNIT_OPTIONS} value={unit} onChange={setUnit} ariaLabel="Goal unit" />
          <NumberField
            label=""
            value={Number(u.fromMl(draftMl).toFixed(u.decimals))}
            onChange={(v) => setDraftMl(u.toMl(Math.max(0, v)))}
            step={u.step}
            min={0}
            suffix={u.label}
          />
        </div>

        <p className="text-center text-sm text-slate-300">
          Goal: <span className="font-semibold text-sky-300">{fmt(draftMl)}</span>
        </p>

        <Button variant="primary" full onClick={save}>
          Save goal
        </Button>
      </div>
    </Sheet>
  )
}

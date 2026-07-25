import { useEffect, useState } from 'react'
import Sheet from '../../components/Sheet'
import Button from '../../components/Button'
import SegmentedControl from '../../components/SegmentedControl'
import WaterCupSlider from '../../components/WaterCupSlider'
import { useNutritionStore } from '../../store/nutrition'
import { useSettingsStore } from '../../store/settings'
import { WATER_UNITS, defaultWaterUnit, type WaterUnit } from '../../lib/units'

type LogWaterSheetProps = {
  open: boolean
  onClose: () => void
  date: string
}

const UNIT_OPTIONS: { key: WaterUnit; label: string }[] = [
  { key: 'oz', label: 'oz' },
  { key: 'cup', label: 'Cups' },
  { key: 'L', label: 'Liters' },
]

// Quick-add chips, in ml — a glass and a half-litre, labelled in the active unit.
const QUICK_ML = [250, 500]

export default function LogWaterSheet({ open, onClose, date }: LogWaterSheetProps) {
  const current = useNutritionStore((s) => s.water[date] ?? 0)
  const addWater = useNutritionStore((s) => s.addWater)
  const goalMl = useSettingsStore((s) => s.waterGoalMl)
  const units = useSettingsStore((s) => s.units)

  const [unit, setUnit] = useState<WaterUnit>(() => defaultWaterUnit(units))
  const [draftMl, setDraftMl] = useState(current)

  // Reopen starts from what's actually logged today (and picks up a day change).
  useEffect(() => {
    if (open) {
      setDraftMl(current)
      setUnit(defaultWaterUnit(units))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, date])

  // A full glass is 1.5× the goal (with at least a litre of headroom), so the goal
  // line sits about two-thirds up and there's still room to log an over-goal day.
  const maxMl = Math.max(goalMl * 1.5, goalMl + 1000)

  function handleSave() {
    addWater(date, draftMl - current)
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title="Log water">
      <div className="space-y-4">
        <SegmentedControl options={UNIT_OPTIONS} value={unit} onChange={setUnit} ariaLabel="Water unit" />

        <WaterCupSlider valueMl={draftMl} goalMl={goalMl} maxMl={maxMl} unit={unit} onChange={setDraftMl} />

        <div className="flex justify-center gap-2">
          {QUICK_ML.map((ml) => {
            const u = WATER_UNITS[unit]
            return (
              <button
                key={ml}
                type="button"
                onClick={() => setDraftMl((v) => Math.min(maxMl, v + ml))}
                className="rounded-full bg-slate-800 px-3 py-1.5 text-xs font-medium text-sky-300 active:bg-slate-700"
              >
                +{u.fromMl(ml).toFixed(u.decimals)} {u.label}
              </button>
            )
          })}
          <button
            type="button"
            onClick={() => setDraftMl(0)}
            className="rounded-full bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-400 active:bg-slate-700"
          >
            Empty
          </button>
        </div>

        <Button variant="primary" full onClick={handleSave}>
          Save
        </Button>
      </div>
    </Sheet>
  )
}

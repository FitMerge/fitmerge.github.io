import { useEffect, useState } from 'react'
import SegmentedControl from '../../components/SegmentedControl'
import WaterCupSlider from '../../components/WaterCupSlider'
import { useNutritionStore } from '../../store/nutrition'
import { useSettingsStore } from '../../store/settings'
import { WATER_UNITS, defaultWaterUnit, type WaterUnit } from '../../lib/units'

type WaterLoggerProps = {
  date: string
}

const UNIT_OPTIONS: { key: WaterUnit; label: string }[] = [
  { key: 'oz', label: 'oz' },
  { key: 'cup', label: 'Cups' },
  { key: 'L', label: 'Liters' },
]

// Quick-add chips, in ml — a glass and a half-litre, labelled in the active unit.
const QUICK_ML = [250, 500]

/**
 * The shared water-logging control: a unit toggle, the drag-to-fill glass, and a
 * few quick adds. Writes the day's total straight to the store (so both the "+"
 * hub and the diary card show the same thing), committing on release rather than
 * on every drag frame.
 */
export default function WaterLogger({ date }: WaterLoggerProps) {
  const current = useNutritionStore((s) => s.water[date] ?? 0)
  const setWater = useNutritionStore((s) => s.setWater)
  const goalMl = useSettingsStore((s) => s.waterGoalMl)
  const units = useSettingsStore((s) => s.units)

  const [unit, setUnit] = useState<WaterUnit>(() => defaultWaterUnit(units))
  const [draftMl, setDraftMl] = useState(current)

  // Keep the draft in step with the stored total (a new day, another device's
  // sync, or our own commits). This never fights an active drag: dragging only
  // moves the draft, leaving `current` untouched until release commits it.
  useEffect(() => {
    setDraftMl(current)
  }, [current, date])

  // A full glass is 1.5× the goal (with at least a litre of headroom), so the goal
  // line sits about two-thirds up and there's still room to log an over-goal day.
  const maxMl = Math.max(goalMl * 1.5, goalMl + 1000)
  const u = WATER_UNITS[unit]

  return (
    <div className="space-y-4">
      <SegmentedControl options={UNIT_OPTIONS} value={unit} onChange={setUnit} ariaLabel="Water unit" />

      <WaterCupSlider
        valueMl={draftMl}
        goalMl={goalMl}
        maxMl={maxMl}
        unit={unit}
        onChange={setDraftMl}
        onCommit={(ml) => setWater(date, ml)}
      />

      <div className="flex flex-wrap justify-center gap-2">
        {QUICK_ML.map((ml) => (
          <button
            key={ml}
            type="button"
            onClick={() => setWater(date, Math.min(maxMl, draftMl + ml))}
            className="rounded-full bg-slate-800 px-3 py-1.5 text-xs font-medium text-sky-300 active:bg-slate-700"
          >
            +{u.fromMl(ml).toFixed(u.decimals)} {u.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setWater(date, 0)}
          className="rounded-full bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-400 active:bg-slate-700"
        >
          Empty
        </button>
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import SegmentedControl from '../../components/SegmentedControl'
import Button from '../../components/Button'
import WaterCupSlider from '../../components/WaterCupSlider'
import { useNutritionStore } from '../../store/nutrition'
import { useSettingsStore } from '../../store/settings'
import { defaultWaterUnit, type WaterUnit } from '../../lib/units'

type WaterLoggerProps = {
  date: string
  /** Called after a save is confirmed (e.g. to close the sheet). */
  onDone?: () => void
}

const UNIT_OPTIONS: { key: WaterUnit; label: string }[] = [
  { key: 'oz', label: 'oz' },
  { key: 'cup', label: 'Cups' },
  { key: 'L', label: 'Liters' },
]

/**
 * The one water control: pick a unit, drag the glass to today's total, hit Save.
 * Nothing is written until you confirm, so there's a single clear action — with a
 * small splash of celebration when it lands.
 */
export default function WaterLogger({ date, onDone }: WaterLoggerProps) {
  const current = useNutritionStore((s) => s.water[date] ?? 0)
  const setWater = useNutritionStore((s) => s.setWater)
  const goalMl = useSettingsStore((s) => s.waterGoalMl)
  const units = useSettingsStore((s) => s.units)

  const [unit, setUnit] = useState<WaterUnit>(() => defaultWaterUnit(units))
  const [draftMl, setDraftMl] = useState(current)
  const [saved, setSaved] = useState(false)

  // Keep the draft in step with the stored total (new day, or another device's
  // sync). Doesn't fight a drag: dragging only moves the draft, not `current`.
  useEffect(() => {
    setDraftMl(current)
  }, [current, date])

  // A full glass is 1.5× the goal (with at least a litre of headroom), so the goal
  // line sits about two-thirds up and there's still room to log an over-goal day.
  const maxMl = Math.max(goalMl * 1.5, goalMl + 1000)

  function confirm() {
    setWater(date, draftMl)
    const reduce =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      onDone?.()
      return
    }
    setSaved(true)
    window.setTimeout(() => {
      setSaved(false)
      onDone?.()
    }, 800)
  }

  return (
    <div className="relative space-y-5">
      <style>{`
        @keyframes wcPop { 0%{ transform: scale(.5); opacity:0 } 45%{ transform: scale(1.12); opacity:1 } 100%{ transform: scale(1); opacity:1 } }
        @keyframes wcRipple { 0%{ transform: scale(.7); opacity:.5 } 100%{ transform: scale(2.2); opacity:0 } }
        .wc-pop { animation: wcPop .5s cubic-bezier(.2,.8,.2,1) both }
        .wc-ripple { animation: wcRipple .8s ease-out both }
        @media (prefers-reduced-motion: reduce) { .wc-pop,.wc-ripple { animation: none } }
      `}</style>

      <SegmentedControl options={UNIT_OPTIONS} value={unit} onChange={setUnit} ariaLabel="Water unit" />

      <WaterCupSlider valueMl={draftMl} goalMl={goalMl} maxMl={maxMl} unit={unit} onChange={setDraftMl} />

      <Button variant="primary" full onClick={confirm}>
        <span className="flex items-center justify-center gap-1.5">
          <Check size={18} /> Save
        </span>
      </Button>

      {saved && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="wc-pop relative flex flex-col items-center gap-2 rounded-2xl bg-slate-900/85 px-7 py-6">
            <span className="wc-ripple absolute top-6 h-14 w-14 rounded-full bg-emerald-400/40" />
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15">
              <Check size={30} className="text-emerald-400" />
            </div>
            <span className="text-sm font-medium text-emerald-300">Water logged 💧</span>
          </div>
        </div>
      )}
    </div>
  )
}

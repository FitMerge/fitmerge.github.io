import { useState } from 'react'
import { Plus } from 'lucide-react'
import SegmentedControl from '../../components/SegmentedControl'
import Button from '../../components/Button'
import WaterCupSlider from '../../components/WaterCupSlider'
import { useNutritionStore } from '../../store/nutrition'
import { useSettingsStore } from '../../store/settings'
import { WATER_UNITS, defaultWaterUnit, type WaterUnit } from '../../lib/units'

type WaterLoggerProps = {
  date: string
  /** Called after an amount is added (e.g. to close the sheet). */
  onDone?: () => void
}

const UNIT_OPTIONS: { key: WaterUnit; label: string }[] = [
  { key: 'oz', label: 'oz' },
  { key: 'cup', label: 'Cups' },
  { key: 'L', label: 'Liters' },
]

// You drink in pours, not day-totals, so the glass logs one serving at a time. It
// starts at a glass and tops out at a litre — the biggest single pour you'd log.
const DEFAULT_ADD_ML = 250
const MAX_ADD_ML = 1000

export default function WaterLogger({ date, onDone }: WaterLoggerProps) {
  const current = useNutritionStore((s) => s.water[date] ?? 0)
  const addWater = useNutritionStore((s) => s.addWater)
  const goalMl = useSettingsStore((s) => s.waterGoalMl)
  const units = useSettingsStore((s) => s.units)

  const [unit, setUnit] = useState<WaterUnit>(() => defaultWaterUnit(units))
  const [amountMl, setAmountMl] = useState(DEFAULT_ADD_ML)
  const [celebration, setCelebration] = useState<{ amount: number; total: number } | null>(null)

  const u = WATER_UNITS[unit]
  const fmt = (ml: number) => `${u.fromMl(ml).toFixed(u.decimals)} ${u.label}`

  const afterMl = current + amountMl
  const pctNow = goalMl > 0 ? Math.min(100, (current / goalMl) * 100) : 0
  const pctAfter = goalMl > 0 ? Math.min(100, (afterMl / goalMl) * 100) : 0

  function confirm() {
    if (amountMl <= 0) return
    const amount = amountMl
    const total = current + amount
    addWater(date, amount)
    const reduce =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      onDone?.()
      return
    }
    setCelebration({ amount, total })
    window.setTimeout(() => {
      setCelebration(null)
      onDone?.()
    }, 900)
  }

  return (
    <div className="relative space-y-3">
      <style>{`
        @keyframes wcPop { 0%{ transform: scale(.5); opacity:0 } 45%{ transform: scale(1.12); opacity:1 } 100%{ transform: scale(1); opacity:1 } }
        @keyframes wcRipple { 0%{ transform: scale(.7); opacity:.5 } 100%{ transform: scale(2.2); opacity:0 } }
        .wc-pop { animation: wcPop .5s cubic-bezier(.2,.8,.2,1) both }
        .wc-ripple { animation: wcRipple .8s ease-out both }
        @media (prefers-reduced-motion: reduce) { .wc-pop,.wc-ripple { animation: none } }
      `}</style>

      <SegmentedControl options={UNIT_OPTIONS} value={unit} onChange={setUnit} ariaLabel="Water unit" />

      <WaterCupSlider valueMl={amountMl} maxMl={MAX_ADD_ML} unit={unit} onChange={setAmountMl} label="Adding" />

      {/* Today's progress, previewing where this pour lands. */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-[11px] text-slate-500">
          <span>Today {fmt(current)}</span>
          <span>Goal {fmt(goalMl)}</span>
        </div>
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-800">
          <div className="absolute inset-y-0 left-0 rounded-full bg-sky-500/40" style={{ width: `${pctAfter}%` }} />
          <div className="absolute inset-y-0 left-0 rounded-full bg-sky-400" style={{ width: `${pctNow}%` }} />
        </div>
      </div>

      <Button variant="primary" full onClick={confirm} disabled={amountMl <= 0}>
        <span className="flex items-center justify-center gap-1.5">
          <Plus size={18} /> Add {fmt(amountMl)}
        </span>
      </Button>

      {celebration && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="wc-pop relative flex flex-col items-center gap-1.5 rounded-2xl bg-slate-900/90 px-7 py-6">
            <span className="wc-ripple absolute top-6 h-14 w-14 rounded-full bg-emerald-400/40" />
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15">
              <Plus size={30} className="text-emerald-400" />
            </div>
            <span className="text-sm font-medium text-emerald-300">Added {fmt(celebration.amount)} 💧</span>
            <span className="text-xs text-slate-400">{fmt(celebration.total)} today</span>
          </div>
        </div>
      )}
    </div>
  )
}

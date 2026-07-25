import { useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import SegmentedControl from '../../components/SegmentedControl'
import Button from '../../components/Button'
import WaterCupSlider from '../../components/WaterCupSlider'
import { useNutritionStore } from '../../store/nutrition'
import { useSettingsStore } from '../../store/settings'
import { WATER_UNITS, defaultWaterUnit, type WaterUnit } from '../../lib/units'

type WaterLoggerProps = {
  date: string
  /** Called from Done — closes the sheet once the user has finished adjusting. */
  onDone?: () => void
}

const UNIT_OPTIONS: { key: WaterUnit; label: string }[] = [
  { key: 'oz', label: 'oz' },
  { key: 'cup', label: 'Cups' },
  { key: 'L', label: 'Liters' },
]

// You drink in pours, so the glass dials one serving. It starts at a glass and
// tops out at a litre — the biggest single pour you'd log or correct.
const DEFAULT_ADD_ML = 250
const MAX_ADD_ML = 1000

export default function WaterLogger({ date, onDone }: WaterLoggerProps) {
  const current = useNutritionStore((s) => s.water[date] ?? 0)
  const addWater = useNutritionStore((s) => s.addWater)
  const goalMl = useSettingsStore((s) => s.waterGoalMl)
  const units = useSettingsStore((s) => s.units)

  const [unit, setUnit] = useState<WaterUnit>(() => defaultWaterUnit(units))
  const [amountMl, setAmountMl] = useState(DEFAULT_ADD_ML)
  const [flash, setFlash] = useState<{ sign: 1 | -1; amount: number } | null>(null)

  const u = WATER_UNITS[unit]
  const fmt = (ml: number) => `${u.fromMl(ml).toFixed(u.decimals)} ${u.label}`

  const pct = goalMl > 0 ? Math.min(100, (current / goalMl) * 100) : 0
  const remaining = Math.max(0, goalMl - current)
  const reached = goalMl > 0 && current >= goalMl

  // Apply the dialed amount as a top-up (+1) or a correction (−1). Stays on screen
  // so the running total updates in place and an over-pour is easy to walk back.
  function apply(sign: 1 | -1) {
    if (amountMl <= 0) return
    addWater(date, sign * amountMl)
    const reduce =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) return
    setFlash({ sign, amount: amountMl })
    window.setTimeout(() => setFlash(null), 750)
  }

  return (
    <div className="relative space-y-3">
      <style>{`
        @keyframes wcPop { 0%{ transform: scale(.6); opacity:0 } 45%{ transform: scale(1.1); opacity:1 } 100%{ transform: scale(1); opacity:1 } }
        .wc-pop { animation: wcPop .45s cubic-bezier(.2,.8,.2,1) both }
        @media (prefers-reduced-motion: reduce) { .wc-pop { animation: none } }
      `}</style>

      <SegmentedControl options={UNIT_OPTIONS} value={unit} onChange={setUnit} ariaLabel="Water unit" />

      {/* Running total — always in view, so you know where you're at as you log. */}
      <div className="rounded-xl bg-slate-800/60 p-3">
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-medium text-slate-400">Today</span>
          <span className="text-sm font-semibold text-slate-100">
            {fmt(current)} <span className="text-slate-500">/ {fmt(goalMl)}</span>
          </span>
        </div>
        <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-900">
          <div className="h-full rounded-full bg-sky-400 transition-[width] duration-300" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-1 text-[11px] text-slate-500">
          {reached ? <span className="text-emerald-400">Goal reached 🎉</span> : `${fmt(remaining)} to go`}
        </p>
      </div>

      <WaterCupSlider valueMl={amountMl} maxMl={MAX_ADD_ML} unit={unit} onChange={setAmountMl} label="Amount" />

      <div className="flex gap-2">
        <Button variant="ghost" full onClick={() => apply(-1)} disabled={amountMl <= 0 || current <= 0}>
          <span className="flex items-center justify-center gap-1.5">
            <Minus size={17} /> Remove
          </span>
        </Button>
        <Button variant="primary" full onClick={() => apply(1)} disabled={amountMl <= 0}>
          <span className="flex items-center justify-center gap-1.5">
            <Plus size={17} /> Add {fmt(amountMl)}
          </span>
        </Button>
      </div>

      {onDone && (
        <button type="button" onClick={onDone} className="w-full py-1 text-center text-sm text-slate-400 active:text-slate-200">
          Done
        </button>
      )}

      {flash && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div
            className={`wc-pop flex items-center gap-2 rounded-2xl bg-slate-900/90 px-6 py-4 ${
              flash.sign > 0 ? 'text-emerald-300' : 'text-amber-300'
            }`}
          >
            <div
              className={`flex h-11 w-11 items-center justify-center rounded-full ${
                flash.sign > 0 ? 'bg-emerald-500/15' : 'bg-amber-500/15'
              }`}
            >
              {flash.sign > 0 ? <Plus size={24} /> : <Minus size={24} />}
            </div>
            <div className="text-left">
              <p className="text-sm font-medium">
                {flash.sign > 0 ? 'Added' : 'Removed'} {fmt(flash.amount)}
              </p>
              <p className="text-xs text-slate-400">{fmt(current)} today</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

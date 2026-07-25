import { useState } from 'react'
import { Droplets, Minus, Plus, SlidersHorizontal } from 'lucide-react'
import Card from '../../components/Card'
import { useNutritionStore } from '../../store/nutrition'
import { useSettingsStore } from '../../store/settings'
import { WATER_UNITS, defaultWaterUnit } from '../../lib/units'
import LogWaterSheet from './LogWaterSheet'

// One glass, for the card's quick add/remove.
const QUICK_WATER_ML = 250

type WaterCardProps = {
  date: string
}

export default function WaterCard({ date }: WaterCardProps) {
  const water = useNutritionStore((s) => s.water[date] ?? 0)
  const addWater = useNutritionStore((s) => s.addWater)
  const goalMl = useSettingsStore((s) => s.waterGoalMl)
  const units = useSettingsStore((s) => s.units)
  const [open, setOpen] = useState(false)

  const u = WATER_UNITS[defaultWaterUnit(units)]
  const fmt = (ml: number) => `${u.fromMl(ml).toFixed(u.decimals)} ${u.label}`
  const pct = goalMl > 0 ? Math.min(100, (water / goalMl) * 100) : 0
  const remaining = Math.max(0, goalMl - water)
  const reached = goalMl > 0 && water >= goalMl

  return (
    <Card className="space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Droplets size={16} className="text-sky-400" />
          <h2 className="text-sm font-semibold text-slate-100">Water</h2>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-1 text-sm text-slate-300 active:text-slate-100"
          aria-label="Adjust water, choose units"
        >
          {fmt(water)} <span className="text-slate-500">/ {fmt(goalMl)}</span>
          <SlidersHorizontal size={13} className="ml-0.5 text-sky-400" />
        </button>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-slate-800">
        <div className="h-full rounded-full bg-sky-400 transition-[width] duration-300" style={{ width: `${pct}%` }} />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">
          {reached ? <span className="text-emerald-400">Goal reached 🎉</span> : `${fmt(remaining)} to go`}
        </p>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label="Remove a glass of water"
            onClick={() => addWater(date, -QUICK_WATER_ML)}
            disabled={water <= 0}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-slate-300 active:bg-slate-700 disabled:opacity-40"
          >
            <Minus size={16} />
          </button>
          <button
            type="button"
            aria-label="Add a glass of water"
            onClick={() => addWater(date, QUICK_WATER_ML)}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/20 text-sky-300 active:bg-sky-500/30"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      <LogWaterSheet open={open} onClose={() => setOpen(false)} date={date} />
    </Card>
  )
}

import { GlassWater } from 'lucide-react'
import Card from '../../components/Card'
import { useNutritionStore } from '../../store/nutrition'
import { useSettingsStore } from '../../store/settings'

const CUPS = 8
const CUP_ML = 250

type WaterCardProps = {
  date: string
}

export default function WaterCard({ date }: WaterCardProps) {
  const water = useNutritionStore((s) => s.water[date] ?? 0)
  const addWater = useNutritionStore((s) => s.addWater)
  const waterGoalMl = useSettingsStore((s) => s.waterGoalMl)

  const filledCups = Math.min(CUPS, Math.round(water / CUP_ML))

  function handleTap(cupIndex: number) {
    // Tapping the highest filled cup removes it; otherwise fill up to that cup.
    const target = cupIndex === filledCups ? (cupIndex - 1) * CUP_ML : cupIndex * CUP_ML
    addWater(date, target - water)
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-100">Water</h2>
        <p className="text-sm text-slate-400">
          {water} / {waterGoalMl} ml
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: CUPS }, (_, i) => i + 1).map((cupIndex) => (
          <button
            key={cupIndex}
            type="button"
            onClick={() => handleTap(cupIndex)}
            aria-label={`Set water to ${cupIndex * CUP_ML} ml`}
            className={`active:scale-[.9] transition ${
              cupIndex <= filledCups ? 'text-sky-400' : 'text-slate-700'
            }`}
          >
            <GlassWater size={24} />
          </button>
        ))}
      </div>
    </Card>
  )
}

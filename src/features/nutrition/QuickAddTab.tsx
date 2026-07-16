import { useState } from 'react'
import Button from '../../components/Button'
import NumberField from '../../components/NumberField'
import { useNutritionStore } from '../../store/nutrition'
import type { MealType } from '../../types'

type QuickAddTabProps = {
  date: string
  mealType: MealType
  onClose: () => void
}

/**
 * MyFitnessPal-style "Quick Add": log a calorie amount (and optional macros) straight
 * into the diary without searching for a food — the fastest path when you just know
 * roughly what you ate.
 */
export default function QuickAddTab({ date, mealType, onClose }: QuickAddTabProps) {
  const addEntry = useNutritionStore((s) => s.addEntry)
  const [calories, setCalories] = useState(0)
  const [protein, setProtein] = useState(0)
  const [carbs, setCarbs] = useState(0)
  const [fat, setFat] = useState(0)
  const [name, setName] = useState('')

  function handleAdd() {
    if (!(calories > 0)) return
    addEntry({
      date,
      mealType,
      name: name.trim() || 'Quick add',
      qty: 1,
      unit: 'serving',
      calories: Math.round(calories),
      protein: Math.round(protein),
      carbs: Math.round(carbs),
      fat: Math.round(fat),
      source: 'manual',
    })
    onClose()
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-slate-100">Quick add</h3>
        <p className="text-sm text-slate-400">Enter calories now; macros are optional.</p>
      </div>

      <NumberField label="Calories" value={calories} onChange={setCalories} step={50} suffix="kcal" />

      <div className="grid grid-cols-3 gap-2">
        <NumberField label="Protein" value={protein} onChange={setProtein} step={5} suffix="g" />
        <NumberField label="Carbs" value={carbs} onChange={setCarbs} step={5} suffix="g" />
        <NumberField label="Fat" value={fat} onChange={setFat} step={5} suffix="g" />
      </div>

      <div>
        <label className="mb-1 block text-sm text-slate-400">Label (optional)</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Restaurant meal"
          className="w-full rounded-lg bg-slate-800 px-3 py-2.5 text-base text-slate-100 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      <Button variant="primary" full onClick={handleAdd} disabled={!(calories > 0)}>
        Add to diary
      </Button>
    </div>
  )
}

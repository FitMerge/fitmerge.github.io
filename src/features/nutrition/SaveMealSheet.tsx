import { useEffect, useState } from 'react'
import Sheet from '../../components/Sheet'
import Button from '../../components/Button'
import { useNutritionStore } from '../../store/nutrition'
import type { FoodEntry } from '../../types'

type SaveMealSheetProps = {
  open: boolean
  onClose: () => void
  mealLabel: string
  dateLabel: string
  entries: FoodEntry[]
}

export default function SaveMealSheet({ open, onClose, mealLabel, dateLabel, entries }: SaveMealSheetProps) {
  const addSavedMeal = useNutritionStore((s) => s.addSavedMeal)
  const [name, setName] = useState(`${mealLabel} ${dateLabel}`)

  useEffect(() => {
    if (open) setName(`${mealLabel} ${dateLabel}`)
  }, [open, mealLabel, dateLabel])

  const totalKcal = entries.reduce((sum, e) => sum + e.calories, 0)
  const canSave = name.trim().length > 0 && entries.length > 0

  function handleSave() {
    if (!canSave) return
    addSavedMeal({
      name: name.trim(),
      items: entries.map((e) => ({
        name: e.name,
        qty: e.qty,
        unit: e.unit,
        calories: e.calories,
        protein: e.protein,
        carbs: e.carbs,
        fat: e.fat,
      })),
    })
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title="Save as meal">
      <div className="space-y-4">
        <div>
          <label className="block text-sm text-slate-400 mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Weekday breakfast"
            className="w-full bg-slate-800 rounded-lg px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div className="space-y-2">
          <p className="text-xs text-slate-500">
            {entries.length} item{entries.length === 1 ? '' : 's'} · {Math.round(totalKcal)} kcal total
          </p>
          <div className="divide-y divide-slate-800/60 rounded-xl bg-slate-800/40">
            {entries.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="truncate text-sm text-slate-200">{e.name}</span>
                <span className="shrink-0 text-xs text-slate-500">{Math.round(e.calories)} kcal</span>
              </div>
            ))}
          </div>
        </div>

        <Button variant="primary" full disabled={!canSave} onClick={handleSave}>
          Save meal
        </Button>
      </div>
    </Sheet>
  )
}

import { useState } from 'react'
import Button from '../../components/Button'
import NumberField from '../../components/NumberField'
import { useNutritionStore } from '../../store/nutrition'
import type { FoodEntry, MealType, SavedMealItem } from '../../types'

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']

type AddManualTabProps = {
  date: string
  entry?: FoodEntry
  /** Prefill values for a fresh (non-edit) entry, e.g. from Quick re-log. Save still adds a new entry. */
  initial?: SavedMealItem
  defaultMealType?: MealType
  onClose: () => void
}

export default function AddManualTab({ date, entry, initial, defaultMealType, onClose }: AddManualTabProps) {
  const addEntry = useNutritionStore((s) => s.addEntry)
  const updateEntry = useNutritionStore((s) => s.updateEntry)
  const removeEntry = useNutritionStore((s) => s.removeEntry)

  const [name, setName] = useState(entry?.name ?? initial?.name ?? '')
  const [qty, setQty] = useState(entry?.qty ?? initial?.qty ?? 1)
  const [unit, setUnit] = useState(entry?.unit ?? initial?.unit ?? 'serving')
  const [calories, setCalories] = useState(entry?.calories ?? initial?.calories ?? 0)
  const [protein, setProtein] = useState(entry?.protein ?? initial?.protein ?? 0)
  const [carbs, setCarbs] = useState(entry?.carbs ?? initial?.carbs ?? 0)
  const [fat, setFat] = useState(entry?.fat ?? initial?.fat ?? 0)
  const [mealType, setMealType] = useState<MealType>(entry?.mealType ?? defaultMealType ?? 'breakfast')

  const canSave = name.trim().length > 0 && calories >= 0

  function handleSave() {
    if (!canSave) return
    if (entry) {
      updateEntry(entry.id, {
        name: name.trim(),
        qty,
        unit,
        calories,
        protein,
        carbs,
        fat,
        mealType,
      })
    } else {
      addEntry({
        date,
        mealType,
        name: name.trim(),
        qty,
        unit,
        calories,
        protein,
        carbs,
        fat,
        source: 'manual',
      })
    }
    onClose()
  }

  function handleDelete() {
    if (!entry) return
    removeEntry(entry.id)
    onClose()
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm text-slate-400 mb-1">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Chicken breast"
          className="w-full bg-slate-800 rounded-lg px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <NumberField label="Quantity" value={qty} onChange={setQty} step={1} min={0} />
        <div>
          <label className="block text-sm text-slate-400 mb-1">Unit</label>
          <input
            type="text"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="w-full bg-slate-800 rounded-lg px-3 py-2.5 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <NumberField label="Calories" value={calories} onChange={setCalories} step={10} min={0} suffix="kcal" />
        <NumberField label="Protein" value={protein} onChange={setProtein} step={1} min={0} suffix="g" />
        <NumberField label="Carbs" value={carbs} onChange={setCarbs} step={1} min={0} suffix="g" />
        <NumberField label="Fat" value={fat} onChange={setFat} step={1} min={0} suffix="g" />
      </div>

      <div>
        <label className="block text-sm text-slate-400 mb-1">Meal</label>
        <div className="grid grid-cols-4 gap-2">
          {MEAL_TYPES.map((mt) => (
            <button
              key={mt}
              type="button"
              onClick={() => setMealType(mt)}
              className={`rounded-full py-1.5 text-xs capitalize ${
                mealType === mt ? 'bg-primary-500 text-slate-950 font-semibold' : 'bg-slate-800 text-slate-300'
              }`}
            >
              {mt}
            </button>
          ))}
        </div>
      </div>

      <Button variant="primary" full disabled={!canSave} onClick={handleSave}>
        Save
      </Button>

      {entry && (
        <Button variant="danger" full onClick={handleDelete}>
          Delete entry
        </Button>
      )}
    </div>
  )
}

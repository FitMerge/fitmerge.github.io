import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
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

  const [fiber, setFiber] = useState(entry?.fiber ?? 0)
  const [sugar, setSugar] = useState(entry?.sugar ?? 0)
  const [sodium, setSodium] = useState(entry?.sodium ?? 0)
  const [showMore, setShowMore] = useState(
    Boolean(entry?.fiber || entry?.sugar || entry?.sodium),
  )

  // Allow a name-less "Quick add" (just calories), MyFitnessPal-style.
  const canSave = name.trim().length > 0 || calories > 0
  const finalName = name.trim() || 'Quick add'

  /**
   * Changing the quantity rescales every nutrient by the same factor — so editing
   * "2 slices" down to "1" halves the macros instead of leaving them stale (which
   * forced a delete-and-readd). Scales from the CURRENT values, so a manual macro
   * tweak afterwards is still respected. No-ops when the old qty is 0 (nothing to
   * scale from) — the user just sets a new quantity.
   */
  function handleQtyChange(next: number) {
    if (qty > 0 && next > 0 && next !== qty) {
      const f = next / qty
      const r1 = (n: number) => Math.round(n * f * 10) / 10
      setCalories(Math.round(calories * f))
      setProtein(r1(protein))
      setCarbs(r1(carbs))
      setFat(r1(fat))
      setFiber(r1(fiber))
      setSugar(r1(sugar))
      setSodium(Math.round(sodium * f))
    }
    setQty(next)
  }

  function handleSave() {
    if (!canSave) return
    const fiberValue = fiber > 0 ? fiber : undefined
    const sugarValue = sugar > 0 ? sugar : undefined
    const sodiumValue = sodium > 0 ? sodium : undefined
    if (entry) {
      updateEntry(entry.id, {
        name: finalName,
        qty,
        unit,
        calories,
        protein,
        carbs,
        fat,
        mealType,
        fiber: fiberValue,
        sugar: sugarValue,
        sodium: sodiumValue,
      })
    } else {
      addEntry({
        date,
        mealType,
        name: finalName,
        qty,
        unit,
        calories,
        protein,
        carbs,
        fat,
        fiber: fiberValue,
        sugar: sugarValue,
        sodium: sodiumValue,
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
        <label className="block text-sm text-slate-400 mb-1">Name (optional — leave blank for a quick calorie add)</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Chicken breast"
          className="w-full bg-slate-800 rounded-lg px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <NumberField label="Quantity" value={qty} onChange={handleQtyChange} step={1} min={0} />
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
        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          className="flex items-center gap-1 text-sm text-slate-400 active:text-slate-200"
        >
          More nutrients
          {showMore ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {showMore && (
          <div className="grid grid-cols-3 gap-3 mt-3">
            <NumberField label="Fiber" value={fiber} onChange={setFiber} step={1} min={0} suffix="g" />
            <NumberField label="Sugar" value={sugar} onChange={setSugar} step={1} min={0} suffix="g" />
            <NumberField label="Sodium" value={sodium} onChange={setSodium} step={50} min={0} suffix="mg" />
          </div>
        )}
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

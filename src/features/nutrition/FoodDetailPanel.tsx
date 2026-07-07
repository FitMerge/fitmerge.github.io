import { useMemo, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import Button from '../../components/Button'
import NumberField from '../../components/NumberField'
import { useNutritionStore } from '../../store/nutrition'
import type { Macros, MealType } from '../../types'

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']

type UnitMode = 'g' | 'serving'

type FoodDetailPanelProps = {
  name: string
  brand?: string
  servingText: string
  per100g?: Macros
  perServing?: Macros
  date: string
  defaultMealType?: MealType
  allowSaveToMyFoods: boolean
  onClose: () => void
  onBack: () => void
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function scale(basis: Macros, factor: number): Macros {
  return {
    calories: basis.calories * factor,
    protein: basis.protein * factor,
    carbs: basis.carbs * factor,
    fat: basis.fat * factor,
  }
}

export default function FoodDetailPanel({
  name,
  brand,
  servingText,
  per100g,
  perServing,
  date,
  defaultMealType,
  allowSaveToMyFoods,
  onClose,
  onBack,
}: FoodDetailPanelProps) {
  const addEntry = useNutritionStore((s) => s.addEntry)
  const addCustomFood = useNutritionStore((s) => s.addCustomFood)

  const unitOptions: { mode: UnitMode; label: string }[] = []
  if (per100g) unitOptions.push({ mode: 'g', label: '100 g' })
  if (perServing) unitOptions.push({ mode: 'serving', label: 'serving' })

  const [unit, setUnit] = useState<UnitMode>(unitOptions[0]?.mode ?? 'serving')
  const [qty, setQty] = useState(unit === 'g' ? 100 : 1)
  const [mealType, setMealType] = useState<MealType>(defaultMealType ?? 'breakfast')
  const [saved, setSaved] = useState(false)

  function handleUnitChange(mode: UnitMode) {
    setUnit(mode)
    setQty(mode === 'g' ? 100 : 1)
  }

  const macros = useMemo<Macros>(() => {
    if (unit === 'g' && per100g) return scale(per100g, qty / 100)
    if (unit === 'serving' && perServing) return scale(perServing, qty)
    return { calories: 0, protein: 0, carbs: 0, fat: 0 }
  }, [unit, qty, per100g, perServing])

  function handleAdd() {
    addEntry({
      date,
      mealType,
      name: brand ? `${name} (${brand})` : name,
      qty,
      unit: unit === 'g' ? 'g' : servingText,
      calories: round1(macros.calories),
      protein: round1(macros.protein),
      carbs: round1(macros.carbs),
      fat: round1(macros.fat),
      source: 'search',
    })
    onClose()
  }

  function handleSaveToMyFoods() {
    addCustomFood({
      name,
      brand,
      serving: servingText,
      per: perServing ?? per100g ?? { calories: 0, protein: 0, carbs: 0, fat: 0 },
    })
    setSaved(true)
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-slate-400 active:text-slate-200"
      >
        <ChevronLeft size={16} />
        Back to search
      </button>

      <div>
        <p className="text-base font-semibold text-slate-100">{name}</p>
        {brand && <p className="text-sm text-slate-500">{brand}</p>}
      </div>

      {unitOptions.length > 1 && (
        <div className="flex gap-2">
          {unitOptions.map((opt) => (
            <button
              key={opt.mode}
              type="button"
              onClick={() => handleUnitChange(opt.mode)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                unit === opt.mode ? 'bg-primary-500 text-slate-950 font-semibold' : 'bg-slate-800 text-slate-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      <NumberField
        label={unit === 'g' ? 'Quantity (g)' : `Quantity (${servingText})`}
        value={qty}
        onChange={setQty}
        step={unit === 'g' ? 10 : 1}
        min={0}
      />

      <p className="text-sm text-slate-300">
        {Math.round(macros.calories)} kcal · P {macros.protein.toFixed(1)} · C {macros.carbs.toFixed(1)} · F{' '}
        {macros.fat.toFixed(1)}
      </p>

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

      <Button variant="primary" full onClick={handleAdd}>
        Add to diary
      </Button>

      {allowSaveToMyFoods && (
        <Button variant="ghost" full onClick={handleSaveToMyFoods} disabled={saved}>
          {saved ? 'Saved to My foods' : 'Save to My foods'}
        </Button>
      )}
    </div>
  )
}

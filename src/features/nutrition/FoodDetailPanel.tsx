import { useMemo, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import Button from '../../components/Button'
import NumberField from '../../components/NumberField'
import { useNutritionStore } from '../../store/nutrition'
import type { Extras } from '../../services/foodSearch/openFoodFacts'
import type { Macros, MealType } from '../../types'

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']

type UnitMode = 'serving' | 'g' | 'oz' | 'cup' | 'tbsp' | 'tsp' | 'floz'

// Grams per one of each measure. Weight units (g, oz) are exact; volume units are
// standard approximations for quick estimating (real grams-per-cup vary by food).
const UNIT_GRAMS: Record<Exclude<UnitMode, 'serving'>, number> = {
  g: 1,
  oz: 28.3495,
  cup: 240,
  tbsp: 15,
  tsp: 5,
  floz: 30,
}
const UNIT_LABEL: Record<UnitMode, string> = {
  serving: 'serving',
  g: 'g',
  oz: 'oz',
  cup: 'cup',
  tbsp: 'tbsp',
  tsp: 'tsp',
  floz: 'fl oz',
}
const VOLUME_UNITS = new Set<UnitMode>(['cup', 'tbsp', 'tsp', 'floz'])
// Order shown in the picker after "serving".
const GRAM_UNIT_ORDER: Exclude<UnitMode, 'serving'>[] = ['g', 'oz', 'cup', 'tbsp', 'tsp', 'floz']

function defaultQtyFor(mode: UnitMode): number {
  return mode === 'g' ? 100 : 1
}

type FoodDetailPanelProps = {
  name: string
  brand?: string
  servingText: string
  per100g?: Macros
  perServing?: Macros
  extras100g?: Extras
  extrasServing?: Extras
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

function scaleExtras(basis: Extras | undefined, factor: number): Extras | undefined {
  if (!basis) return undefined
  const extras: Extras = {}
  if (basis.fiber !== undefined) extras.fiber = basis.fiber * factor
  if (basis.sugar !== undefined) extras.sugar = basis.sugar * factor
  if (basis.sodiumMg !== undefined) extras.sodiumMg = basis.sodiumMg * factor
  return extras
}

export default function FoodDetailPanel({
  name,
  brand,
  servingText,
  per100g,
  perServing,
  extras100g,
  extrasServing,
  date,
  defaultMealType,
  allowSaveToMyFoods,
  onClose,
  onBack,
}: FoodDetailPanelProps) {
  const addEntry = useNutritionStore((s) => s.addEntry)
  const addCustomFood = useNutritionStore((s) => s.addCustomFood)

  // Serving is listed first so it's the default: logging "1" should mean one
  // natural serving (e.g. 1 large egg), not 1 gram. When per-100g data exists we
  // also offer weight (g, oz) and household volume units (cup/tbsp/tsp) so you can
  // log the way you actually measure — especially when estimating.
  const unitOptions: { mode: UnitMode; label: string }[] = []
  if (perServing) unitOptions.push({ mode: 'serving', label: 'serving' })
  if (per100g) for (const m of GRAM_UNIT_ORDER) unitOptions.push({ mode: m, label: UNIT_LABEL[m] })

  const [unit, setUnit] = useState<UnitMode>(unitOptions[0]?.mode ?? 'serving')
  const [qty, setQty] = useState(defaultQtyFor(unitOptions[0]?.mode ?? 'serving'))
  const [mealType, setMealType] = useState<MealType>(defaultMealType ?? 'breakfast')
  const [saved, setSaved] = useState(false)

  function handleUnitChange(mode: UnitMode) {
    setUnit(mode)
    setQty(defaultQtyFor(mode))
  }

  // Grams represented by the current qty (for gram-based units); undefined for serving.
  const gramsForQty = unit === 'serving' ? undefined : qty * UNIT_GRAMS[unit]

  const macros = useMemo<Macros>(() => {
    if (unit === 'serving' && perServing) return scale(perServing, qty)
    if (gramsForQty !== undefined && per100g) return scale(per100g, gramsForQty / 100)
    return { calories: 0, protein: 0, carbs: 0, fat: 0 }
  }, [unit, qty, per100g, perServing, gramsForQty])

  const extras = useMemo<Extras | undefined>(() => {
    if (unit === 'serving') return scaleExtras(extrasServing, qty)
    if (gramsForQty !== undefined) return scaleExtras(extras100g, gramsForQty / 100)
    return undefined
  }, [unit, qty, extras100g, extrasServing, gramsForQty])

  function handleAdd() {
    if (!(qty > 0)) return
    const fiber = extras?.fiber !== undefined && extras.fiber > 0 ? round1(extras.fiber) : undefined
    const sugar = extras?.sugar !== undefined && extras.sugar > 0 ? round1(extras.sugar) : undefined
    const sodium = extras?.sodiumMg !== undefined && extras.sodiumMg > 0 ? Math.round(extras.sodiumMg) : undefined

    addEntry({
      date,
      mealType,
      name: brand ? `${name} (${brand})` : name,
      qty,
      unit: unit === 'serving' ? servingText : UNIT_LABEL[unit],
      calories: round1(macros.calories),
      protein: round1(macros.protein),
      carbs: round1(macros.carbs),
      fat: round1(macros.fat),
      fiber,
      sugar,
      sodium,
      source: 'search',
    })
    onClose()
  }

  function handleSaveToMyFoods() {
    // Save the macros paired with a MATCHING serving label. When only per-100g
    // data exists (common for branded results), label it "100 g" — otherwise the
    // per-100g numbers would be charged against the product's smaller serving
    // string (e.g. "30 g") and re-logging would massively overcount.
    const hasServing = perServing !== undefined
    addCustomFood({
      name,
      brand,
      serving: hasServing ? servingText : '100 g',
      per: hasServing ? perServing : per100g ?? { calories: 0, protein: 0, carbs: 0, fat: 0 },
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
        <div className="flex gap-2 overflow-x-auto pb-1">
          {unitOptions.map((opt) => (
            <button
              key={opt.mode}
              type="button"
              onClick={() => handleUnitChange(opt.mode)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${
                unit === opt.mode ? 'bg-primary-500 text-slate-950 font-semibold' : 'bg-slate-800 text-slate-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      <NumberField
        label={`Quantity (${unit === 'serving' ? servingText : UNIT_LABEL[unit]})`}
        value={qty}
        onChange={setQty}
        step={unit === 'g' ? 10 : 1}
        min={0}
      />

      {gramsForQty !== undefined && (
        <p className="text-xs text-slate-500">
          ≈ {Math.round(gramsForQty)} g
          {VOLUME_UNITS.has(unit) ? ' · volume is an estimate; grams or oz are exact' : ''}
        </p>
      )}

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

      <Button variant="primary" full onClick={handleAdd} disabled={!(qty > 0)}>
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

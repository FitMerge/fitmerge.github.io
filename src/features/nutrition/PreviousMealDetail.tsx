// One past meal, ready to be re-logged: every item checked, each one adjustable.
//
// Re-logging an identical morning is two taps. A morning that differed by one egg
// and no salsa is four. That is the whole feature — the plate is kept intact and
// everything after it is subtraction.

import { useState } from 'react'
import { Check, ChevronLeft, SlidersHorizontal } from 'lucide-react'
import Button from '../../components/Button'
import NumberField from '../../components/NumberField'
import { isoToLabel } from '../../lib/date'
import {
  compatibleUnits,
  conversionFactor,
  defaultQtyFor,
  parseServing,
  scaleMacros,
  servingLabel,
  stepFor,
  UNIT_LABEL,
} from '../../lib/portion'
import { useNutritionStore } from '../../store/nutrition'
import type { PastMeal, PastMealItem } from './pastMeals'
import type { Macros, MealType } from '../../types'

/** Per-item edits layered over the meal as it was originally logged. */
type ItemState = { checked: boolean; qty: number; unit: string }

function initialState(item: PastMealItem): ItemState {
  const parsed = parseServing(`${item.qty} ${item.unit}`)
  return { checked: true, qty: parsed.qty, unit: parsed.unit }
}

function round(n: number): number {
  return Math.round(n * 10) / 10
}

/** Macros for one row at its currently chosen amount. */
function scaled(item: PastMealItem, state: ItemState): Macros {
  const base = parseServing(`${item.qty} ${item.unit}`)
  return scaleMacros(item, conversionFactor(base, state.qty, state.unit) ?? 1)
}

type Props = {
  meal: PastMeal
  date: string
  mealType: MealType
  mealLabel: string
  onBack: () => void
  onDone: () => void
}

export default function PreviousMealDetail({
  meal,
  date,
  mealType,
  mealLabel,
  onBack,
  onDone,
}: Props) {
  const addEntry = useNutritionStore((s) => s.addEntry)

  const [items, setItems] = useState<ItemState[]>(() => meal.items.map(initialState))
  // Which row has its portion controls open. One at a time, so the list stays
  // scannable while you fix the one amount that was different.
  const [editing, setEditing] = useState<number | null>(null)

  function patch(index: number, next: Partial<ItemState>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...next } : it)))
  }

  const selected = meal.items
    .map((item, i) => ({ item, state: items[i] }))
    .filter((x) => x.state?.checked)

  const total = selected.reduce<Macros>(
    (sum, { item, state }) => {
      const m = scaled(item, state)
      return {
        calories: sum.calories + m.calories,
        protein: sum.protein + m.protein,
        carbs: sum.carbs + m.carbs,
        fat: sum.fat + m.fat,
      }
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  )

  function addSelected() {
    for (const { item, state } of selected) {
      const m = scaled(item, state)
      addEntry({
        date,
        mealType,
        name: item.name,
        qty: state.qty,
        unit: state.unit,
        calories: round(m.calories),
        protein: round(m.protein),
        carbs: round(m.carbs),
        fat: round(m.fat),
      })
    }
    onDone()
  }

  const allChecked = items.every((i) => i.checked)

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-slate-400 active:text-slate-200"
      >
        <ChevronLeft size={16} /> Back
      </button>

      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-100">{isoToLabel(meal.date)}</p>
        <button
          type="button"
          onClick={() => setItems((prev) => prev.map((i) => ({ ...i, checked: !allChecked })))}
          className="text-xs font-medium text-primary-400 active:text-primary-300"
        >
          {allChecked ? 'Uncheck all' : 'Check all'}
        </button>
      </div>

      <div className="space-y-1.5">
        {meal.items.map((item, i) => {
          const state = items[i]
          if (!state) return null
          const m = scaled(item, state)
          const base = parseServing(`${item.qty} ${item.unit}`)
          const units = compatibleUnits(base.unit)
          const isEditing = editing === i

          return (
            <div
              key={`${item.name}-${i}`}
              className={`rounded-xl ${state.checked ? 'bg-slate-900' : 'bg-slate-900/40'}`}
            >
              <div className="flex items-center gap-2.5 p-2.5">
                <button
                  type="button"
                  onClick={() => patch(i, { checked: !state.checked })}
                  aria-label={state.checked ? `Remove ${item.name}` : `Include ${item.name}`}
                  aria-pressed={state.checked}
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${
                    state.checked
                      ? 'border-primary-500 bg-primary-500 text-slate-950'
                      : 'border-slate-600 text-transparent'
                  }`}
                >
                  <Check size={14} strokeWidth={3} />
                </button>

                <button
                  type="button"
                  onClick={() => setEditing(isEditing ? null : i)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-sm ${
                        state.checked ? 'text-slate-100' : 'text-slate-500 line-through'
                      }`}
                    >
                      {item.name}
                    </span>
                    <span className="block truncate text-[11px] text-slate-500">
                      {servingLabel(state.qty, state.unit)} · {Math.round(m.calories)} kcal
                    </span>
                  </span>
                  <SlidersHorizontal
                    size={14}
                    className={`shrink-0 ${isEditing ? 'text-primary-400' : 'text-slate-500'}`}
                  />
                </button>
              </div>

              {isEditing && (
                <div className="space-y-2 border-t border-slate-800 p-2.5">
                  <NumberField
                    label={`Amount (${UNIT_LABEL[state.unit] ?? state.unit})`}
                    value={state.qty}
                    onChange={(qty) => patch(i, { qty })}
                    step={stepFor(state.unit)}
                    min={0}
                  />

                  {units.length > 1 && (
                    <div className="flex gap-1.5 overflow-x-auto pb-1">
                      {units.map((u) => (
                        <button
                          key={u}
                          type="button"
                          // A unit change restates the portion, so the amount restarts:
                          // carrying "2" from tbsp into cups is arithmetic, not intent.
                          onClick={() => patch(i, { unit: u, qty: defaultQtyFor(u) })}
                          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${
                            state.unit === u
                              ? 'bg-primary-500 font-semibold text-slate-950'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {UNIT_LABEL[u] ?? u}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-1.5">
                    {[0.5, 1, 1.5, 2, 3].map((mult) => (
                      <button
                        key={mult}
                        type="button"
                        onClick={() => patch(i, { unit: base.unit, qty: round(base.qty * mult) })}
                        className="flex-1 rounded-lg bg-slate-800 py-1.5 text-[11px] font-medium text-slate-300 active:bg-slate-700"
                      >
                        {mult}×
                      </button>
                    ))}
                  </div>

                  <p className="text-center text-[11px] tabular-nums text-slate-500">
                    {m.protein.toFixed(1)}P · {m.carbs.toFixed(1)}C · {m.fat.toFixed(1)}F
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="rounded-xl bg-slate-800/60 p-3 text-center">
        <p className="text-xl font-bold tabular-nums text-slate-100">
          {Math.round(total.calories)} kcal
        </p>
        <p className="text-xs tabular-nums text-slate-400">
          {total.protein.toFixed(1)}P · {total.carbs.toFixed(1)}C · {total.fat.toFixed(1)}F
        </p>
      </div>

      <Button variant="primary" full onClick={addSelected} disabled={selected.length === 0}>
        Add {selected.length} item{selected.length === 1 ? '' : 's'} to {mealLabel.toLowerCase()}
      </Button>
    </div>
  )
}

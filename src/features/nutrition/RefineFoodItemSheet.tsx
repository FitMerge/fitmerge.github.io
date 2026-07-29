// Tap a suggested food, fix what's wrong with it, done.
//
// The AI is usually close and rarely exact: it names a near neighbour of what you
// ate, and it guesses a portion. Both were expensive to correct — swapping meant
// retyping the name AND all four macros, and changing "1 tbsp" to "3" meant doing
// the multiplication yourself. Either one is enough to make logging a meal stop
// feeling quick, which is the whole reason this path exists.
//
// So one sheet does both: the runners-up the model already ranked, and a portion
// control that rescales the macros as you turn it.

import { useEffect, useMemo, useState } from 'react'
import { Check, Repeat2 } from 'lucide-react'
import Sheet from '../../components/Sheet'
import Button from '../../components/Button'
import NumberField from '../../components/NumberField'
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
import type { FoodAlternative, FoodAnalysisItem } from '../../services/vision/types'
import type { Macros } from '../../types'

export type RefinedItem = {
  name: string
  servingText: string
  calories: number
  protein: number
  carbs: number
  fat: number
}

type Props = {
  item: (FoodAnalysisItem & { id: string }) | null
  onClose: () => void
  onApply: (patch: RefinedItem) => void
}

function round(n: number): number {
  return Math.round(n * 10) / 10
}

/** How sure the model was — shown here rather than on the list row, because this
 * is the screen where you decide whether to trust or replace the reading. */
function confidenceClasses(c: number): string {
  if (c >= 0.75) return 'bg-emerald-500/15 text-emerald-400'
  if (c >= 0.5) return 'bg-amber-500/15 text-amber-400'
  return 'bg-red-500/15 text-red-400'
}

export default function RefineFoodItemSheet({ item, onClose, onApply }: Props) {
  // The identification currently chosen — the headline to start, or whichever
  // alternative was tapped. Its own servingText is the basis for scaling.
  const [base, setBase] = useState<RefinedItem | null>(null)
  const [qty, setQty] = useState(1)
  const [unit, setUnit] = useState('serving')

  // Reset whenever a different item is opened, so reopening never inherits the
  // last item's portion.
  useEffect(() => {
    if (!item) return
    const parsed = parseServing(item.servingText)
    setBase({
      name: item.name,
      servingText: item.servingText,
      calories: item.calories,
      protein: item.protein,
      carbs: item.carbs,
      fat: item.fat,
    })
    setQty(parsed.qty)
    setUnit(parsed.unit)
  }, [item?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const parsedBase = useMemo(
    () => (base ? parseServing(base.servingText) : null),
    [base],
  )

  const factor = useMemo(() => {
    if (!parsedBase) return 1
    return conversionFactor(parsedBase, qty, unit) ?? 1
  }, [parsedBase, qty, unit])

  const macros = useMemo<Macros>(() => {
    if (!base) return { calories: 0, protein: 0, carbs: 0, fat: 0 }
    return scaleMacros(base, factor)
  }, [base, factor])

  const units = parsedBase ? compatibleUnits(parsedBase.unit) : []
  const alternatives = item?.alternatives ?? []

  function chooseAlternative(alt: FoodAlternative) {
    // An alternative brings its own portion. Adopting it wholesale is right:
    // "1 tbsp olive oil" and "1 pat of butter" are not the same amount, so
    // carrying the old quantity across would silently invent a number.
    const parsed = parseServing(alt.servingText)
    setBase({ ...alt })
    setQty(parsed.qty)
    setUnit(parsed.unit)
  }

  function apply() {
    if (!base) return
    onApply({
      name: base.name,
      servingText: servingLabel(qty, unit),
      calories: round(macros.calories),
      protein: round(macros.protein),
      carbs: round(macros.carbs),
      fat: round(macros.fat),
    })
    onClose()
  }

  const swapped = base !== null && item !== null && base.name !== item.name

  return (
    <Sheet open={item !== null} onClose={onClose} title="Adjust this item">
      {base && (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-base font-semibold text-slate-100">{base.name}</p>
              <p className="text-xs text-slate-500">
                AI estimate for {base.servingText}
                {swapped && <span className="text-emerald-400"> · swapped</span>}
              </p>
            </div>
            {!swapped && item && (
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] ${confidenceClasses(item.confidence)}`}
                title="How sure the AI was about this identification and portion"
              >
                {Math.round(item.confidence * 100)}%
              </span>
            )}
          </div>

          {/* Portion first: it is the correction people make most often, and the
              one that used to cost four numbers of arithmetic. */}
          <div className="space-y-2">
            <NumberField
              label={`Portion (${UNIT_LABEL[unit] ?? unit})`}
              value={qty}
              onChange={setQty}
              step={stepFor(unit)}
              min={0}
            />

            {units.length > 1 && (
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {units.map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => {
                      setUnit(u)
                      setQty(defaultQtyFor(u))
                    }}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${
                      unit === u ? 'bg-primary-500 font-semibold text-slate-950' : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {UNIT_LABEL[u] ?? u}
                  </button>
                ))}
              </div>
            )}

            <div className="flex gap-1.5">
              {[0.5, 1, 1.5, 2, 3].map((m) => {
                const target = round((parsedBase?.qty ?? 1) * m)
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setUnit(parsedBase?.unit ?? unit)
                      setQty(target)
                    }}
                    className="flex-1 rounded-lg bg-slate-800 py-1.5 text-[11px] font-medium text-slate-300 active:bg-slate-700"
                  >
                    {m}×
                  </button>
                )
              })}
            </div>
          </div>

          <div className="rounded-xl bg-slate-800/60 p-3 text-center">
            <p className="text-xl font-bold text-slate-100 tabular-nums">
              {Math.round(macros.calories)} kcal
            </p>
            <p className="text-xs text-slate-400 tabular-nums">
              {macros.protein.toFixed(1)}P · {macros.carbs.toFixed(1)}C · {macros.fat.toFixed(1)}F
            </p>
            <p className="mt-1 text-[11px] text-slate-500">for {servingLabel(qty, unit)}</p>
          </div>

          {/* Quick swap: the runners-up the model already ranked. */}
          {alternatives.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Repeat2 size={14} className="text-slate-400" />
                <p className="text-xs font-medium text-slate-300">Not right? Quick swap</p>
              </div>
              <p className="text-[11px] text-slate-500">
                The other readings the AI considered, most likely first.
              </p>
              {alternatives.map((alt) => {
                const active = alt.name === base.name
                return (
                  <button
                    key={alt.name}
                    type="button"
                    onClick={() => chooseAlternative(alt)}
                    className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left ${
                      active ? 'bg-emerald-500/15' : 'bg-slate-800/60 active:bg-slate-800'
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-slate-100">{alt.name}</span>
                      <span className="block truncate text-[11px] text-slate-500">
                        {alt.servingText} · {Math.round(alt.protein)}P {Math.round(alt.carbs)}C{' '}
                        {Math.round(alt.fat)}F
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-200">
                      {Math.round(alt.calories)}
                    </span>
                    {active && <Check size={14} className="shrink-0 text-emerald-400" />}
                  </button>
                )
              })}
              {/* Restoring the original must always be possible, or a swap is a
                  one-way door and people stop trying it. */}
              {swapped && item && (
                <button
                  type="button"
                  onClick={() =>
                    chooseAlternative({
                      name: item.name,
                      servingText: item.servingText,
                      calories: item.calories,
                      protein: item.protein,
                      carbs: item.carbs,
                      fat: item.fat,
                    })
                  }
                  className="w-full pt-1 text-center text-[11px] font-medium text-slate-400"
                >
                  Back to {item.name}
                </button>
              )}
            </div>
          )}

          <Button variant="primary" full onClick={apply} disabled={!(qty > 0)}>
            Use this
          </Button>
        </div>
      )}
    </Sheet>
  )
}

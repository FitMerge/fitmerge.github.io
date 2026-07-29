// The day cards: which previous breakfast do you want back?
//
// A breakfast is recognisable by what was on it, not by its total, so the cards
// lead with food names. Three at a time — this sits above Recent and Frequent in
// the hub, and a fortnight of cards would bury them.

import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { isoToLabel } from '../../lib/date'
import { mealSummary, type PastMeal } from './pastMeals'

const COLLAPSED = 3

type Props = {
  meals: PastMeal[]
  onOpen: (meal: PastMeal) => void
}

export default function PreviousMealsSection({ meals, onOpen }: Props) {
  const [expanded, setExpanded] = useState(false)
  if (meals.length === 0) return null

  const shown = expanded ? meals : meals.slice(0, COLLAPSED)

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-slate-300">Previous meals</h3>
      {shown.map((meal) => (
        <button
          key={meal.date}
          type="button"
          onClick={() => onOpen(meal)}
          className="flex w-full items-center gap-3 rounded-xl bg-slate-900 p-3 text-left active:bg-slate-800"
        >
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline gap-2">
              <span className="text-sm font-semibold text-slate-100">{isoToLabel(meal.date)}</span>
              <span className="text-xs tabular-nums text-slate-400">
                {Math.round(meal.calories)} kcal
              </span>
              <span className="text-xs text-slate-500">
                · {meal.items.length} item{meal.items.length === 1 ? '' : 's'}
              </span>
            </span>
            <span className="mt-0.5 block truncate text-xs text-slate-400">
              {mealSummary(meal.items)}
            </span>
          </span>
          <ChevronRight size={16} className="shrink-0 text-slate-500" />
        </button>
      ))}
      {meals.length > COLLAPSED && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="w-full py-1 text-xs font-medium text-slate-400 active:text-slate-200"
        >
          {expanded ? 'Show fewer' : `Show all ${meals.length} days`}
        </button>
      )}
    </section>
  )
}

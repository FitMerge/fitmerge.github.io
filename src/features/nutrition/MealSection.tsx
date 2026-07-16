import { BookmarkPlus, Plus } from 'lucide-react'
import Card from '../../components/Card'
import FoodEntryRow from './FoodEntryRow'
import { sumMacros } from '../../lib/macros'
import type { FoodEntry } from '../../types'

type MealSectionProps = {
  label: string
  entries: FoodEntry[]
  onAdd: () => void
  onSelectEntry: (entry: FoodEntry) => void
  onSaveMeal: () => void
}

/**
 * One meal block in the food diary — MyFitnessPal's "Today" layout: the meal is
 * always shown (even empty) with its calorie subtotal, the logged foods, and a
 * clear full-width "Add food" button so logging into a specific meal is one tap.
 */
export default function MealSection({ label, entries, onAdd, onSelectEntry, onSaveMeal }: MealSectionProps) {
  const totals = sumMacros(entries)

  return (
    <Card className="!p-0 overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex items-baseline gap-2">
          <h3 className="text-sm font-semibold text-slate-100">{label}</h3>
          <span className="text-xs text-slate-500">{Math.round(totals.calories)} kcal</span>
        </div>
        {entries.length > 0 && (
          <button
            type="button"
            onClick={onSaveMeal}
            aria-label={`Save ${label} as a meal`}
            className="-mr-1 flex h-9 w-9 items-center justify-center rounded-full text-slate-400 active:bg-slate-800"
          >
            <BookmarkPlus size={17} />
          </button>
        )}
      </div>

      {entries.length > 0 && (
        <div className="divide-y divide-slate-800/60 px-4">
          {entries.map((entry) => (
            <FoodEntryRow key={entry.id} entry={entry} onClick={() => onSelectEntry(entry)} />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={onAdd}
        className="flex w-full items-center gap-2 border-t border-slate-800/60 px-4 py-3 text-sm font-medium text-primary-400 active:bg-slate-800/50"
      >
        <Plus size={17} strokeWidth={2.5} />
        Add food
      </button>
    </Card>
  )
}

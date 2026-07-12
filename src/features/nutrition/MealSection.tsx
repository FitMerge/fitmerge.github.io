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

export default function MealSection({ label, entries, onAdd, onSelectEntry, onSaveMeal }: MealSectionProps) {
  const totals = sumMacros(entries)

  return (
    <Card>
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">{label}</h3>
          <p className="text-xs text-slate-500">{Math.round(totals.calories)} kcal</p>
        </div>
        <div className="flex items-center gap-2">
          {entries.length > 0 && (
            <button
              type="button"
              onClick={onSaveMeal}
              aria-label={`Save ${label} as meal`}
              className="w-8 h-8 rounded-full bg-slate-800 active:bg-slate-700 flex items-center justify-center text-slate-300"
            >
              <BookmarkPlus size={16} />
            </button>
          )}
          <button
            type="button"
            onClick={onAdd}
            aria-label={`Add food to ${label}`}
            className="w-8 h-8 rounded-full bg-slate-800 active:bg-slate-700 flex items-center justify-center text-primary-400"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {entries.length === 0 ? (
        <p className="pt-2.5 text-xs text-slate-500">No entries yet</p>
      ) : (
        <div className="divide-y divide-slate-800/60">
          {entries.map((entry) => (
            <FoodEntryRow key={entry.id} entry={entry} onClick={() => onSelectEntry(entry)} />
          ))}
        </div>
      )}
    </Card>
  )
}

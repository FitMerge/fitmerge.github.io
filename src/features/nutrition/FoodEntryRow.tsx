import type { FoodEntry } from '../../types'

type FoodEntryRowProps = {
  entry: FoodEntry
  onClick: () => void
}

export default function FoodEntryRow({ entry, onClick }: FoodEntryRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center justify-between gap-3 py-2.5 text-left"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm text-slate-100 truncate">{entry.name}</p>
        <p className="text-xs text-slate-500">
          {entry.qty} {entry.unit}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm text-slate-100">{Math.round(entry.calories)} kcal</p>
        <p className="text-xs text-slate-500">
          P {Math.round(entry.protein)} · C {Math.round(entry.carbs)} · F {Math.round(entry.fat)}
        </p>
      </div>
    </button>
  )
}

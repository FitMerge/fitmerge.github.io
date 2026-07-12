import { useEffect, useState } from 'react'
import { Camera, ChevronLeft, X } from 'lucide-react'
import AddManualTab from './AddManualTab'
import AddPhotoTab from './AddPhotoTab'
import AddSearchTab from './AddSearchTab'
import type { MealType } from '../../types'

const MEALS: { type: MealType; label: string }[] = [
  { type: 'breakfast', label: 'Breakfast' },
  { type: 'lunch', label: 'Lunch' },
  { type: 'dinner', label: 'Dinner' },
  { type: 'snack', label: 'Snacks' },
]

type View = 'browse' | 'manual' | 'photo'

type AddFoodSheetProps = {
  open: boolean
  onClose: () => void
  date: string
  defaultMealType: MealType
}

export default function AddFoodSheet({ open, onClose, date, defaultMealType }: AddFoodSheetProps) {
  const [mealType, setMealType] = useState<MealType>(defaultMealType)
  const [view, setView] = useState<View>('browse')

  // Reset meal + view each time the screen opens.
  useEffect(() => {
    if (open) {
      setMealType(defaultMealType)
      setView('browse')
    }
  }, [open, defaultMealType])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col">
      {/* Header: close, title, done, and the meal selector — always visible so you
          always know (and can change) which meal you're logging into. */}
      <div className="shrink-0 border-b border-slate-800" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="flex items-center gap-3 px-4 h-14">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 -ml-1.5 text-slate-300 active:text-slate-100"
          >
            <X size={22} />
          </button>
          <h2 className="text-base font-bold text-slate-100 flex-1">Add Food</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-semibold text-emerald-400 active:text-emerald-300"
          >
            Done
          </button>
        </div>
        <div className="flex gap-1.5 px-4 pb-3 overflow-x-auto">
          {MEALS.map((m) => (
            <button
              key={m.type}
              type="button"
              onClick={() => setMealType(m.type)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium ${
                mealType === m.type ? 'bg-primary-500 text-slate-950' : 'bg-slate-800 text-slate-300'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div
        className="flex-1 overflow-y-auto p-4"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.5rem)' }}
      >
        {view === 'browse' && (
          <div className="space-y-4">
            <AddSearchTab date={date} mealType={mealType} onClose={onClose} onManual={() => setView('manual')} />
            <button
              type="button"
              onClick={() => setView('photo')}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-slate-800 py-3 text-sm text-slate-200 active:bg-slate-700"
            >
              <Camera size={16} /> Log with a photo
            </button>
          </div>
        )}

        {view === 'manual' && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setView('browse')}
              className="flex items-center gap-1 text-sm text-slate-400 active:text-slate-200"
            >
              <ChevronLeft size={16} /> Back to search
            </button>
            <AddManualTab date={date} defaultMealType={mealType} onClose={onClose} />
          </div>
        )}

        {view === 'photo' && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setView('browse')}
              className="flex items-center gap-1 text-sm text-slate-400 active:text-slate-200"
            >
              <ChevronLeft size={16} /> Back to search
            </button>
            <AddPhotoTab date={date} defaultMealType={mealType} onClose={onClose} />
          </div>
        )}
      </div>
    </div>
  )
}

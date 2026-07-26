import { useEffect, useState } from 'react'
import { Camera, ChevronLeft, Wand2, X, Zap } from 'lucide-react'
import AddDescribeTab from './AddDescribeTab'
import AddManualTab from './AddManualTab'
import AddPhotoTab from './AddPhotoTab'
import AddSearchTab from './AddSearchTab'
import QuickAddTab from './QuickAddTab'
import type { MealType } from '../../types'

const MEALS: { type: MealType; label: string }[] = [
  { type: 'breakfast', label: 'Breakfast' },
  { type: 'lunch', label: 'Lunch' },
  { type: 'dinner', label: 'Dinner' },
  { type: 'snack', label: 'Snacks' },
]

type View = 'browse' | 'manual' | 'photo' | 'quickadd' | 'describe'

type AddFoodSheetProps = {
  open: boolean
  onClose: () => void
  date: string
  defaultMealType: MealType
}

export default function AddFoodSheet({ open, onClose, date, defaultMealType }: AddFoodSheetProps) {
  const [mealType, setMealType] = useState<MealType>(defaultMealType)
  const [view, setView] = useState<View>('browse')
  // `mounted` keeps the page in the DOM through its exit slide; `shown` drives the
  // transform so it slides UP from the bottom (MFP's full-screen add flow) instead
  // of hard-popping into place.
  const [mounted, setMounted] = useState(open)
  const [shown, setShown] = useState(false)

  // Reset meal + view each time the screen opens.
  useEffect(() => {
    if (open) {
      setMealType(defaultMealType)
      setView('browse')
    }
  }, [open, defaultMealType])

  useEffect(() => {
    if (open) {
      setMounted(true)
      const id = requestAnimationFrame(() => setShown(true))
      return () => cancelAnimationFrame(id)
    }
    setShown(false)
    const t = setTimeout(() => setMounted(false), 240)
    return () => clearTimeout(t)
  }, [open])

  // Lock the page behind from scrolling while this full-screen sheet is up.
  useEffect(() => {
    if (!mounted) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [mounted])

  if (!mounted) return null

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-slate-950 will-change-transform"
      style={{
        transform: shown ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 260ms cubic-bezier(0.32, 0.72, 0, 1)',
      }}
    >
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
        className="flex-1 overflow-y-auto overscroll-contain p-4"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.5rem)' }}
      >
        {view === 'browse' && (
          <div className="space-y-4">
            {/* Above search on purpose: a plate of real food is one sentence here,
                but several separate lookups through the database. */}
            <button
              type="button"
              onClick={() => setView('describe')}
              className="flex w-full items-center gap-3 rounded-xl bg-gradient-to-br from-primary-500/20 to-slate-900 p-3 text-left active:opacity-80"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-500/20">
                <Wand2 size={17} className="text-primary-300" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-primary-200">Describe your meal</span>
                <span className="mt-0.5 block text-xs text-slate-300">
                  Type it how you'd say it — we&apos;ll break it into items and macros
                </span>
              </span>
            </button>

            <AddSearchTab date={date} mealType={mealType} onClose={onClose} onManual={() => setView('manual')} />
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setView('quickadd')}
                className="flex items-center justify-center gap-2 rounded-lg bg-slate-800 py-3 text-sm text-slate-200 active:bg-slate-700"
              >
                <Zap size={16} /> Quick add
              </button>
              <button
                type="button"
                onClick={() => setView('photo')}
                className="flex items-center justify-center gap-2 rounded-lg bg-slate-800 py-3 text-sm text-slate-200 active:bg-slate-700"
              >
                <Camera size={16} /> Photo
              </button>
            </div>
          </div>
        )}

        {view === 'describe' && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setView('browse')}
              className="flex items-center gap-1 text-sm text-slate-400 active:text-slate-200"
            >
              <ChevronLeft size={16} /> Back to search
            </button>
            <AddDescribeTab date={date} mealType={mealType} onClose={onClose} />
          </div>
        )}

        {view === 'quickadd' && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setView('browse')}
              className="flex items-center gap-1 text-sm text-slate-400 active:text-slate-200"
            >
              <ChevronLeft size={16} /> Back to search
            </button>
            <QuickAddTab date={date} mealType={mealType} onClose={onClose} />
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

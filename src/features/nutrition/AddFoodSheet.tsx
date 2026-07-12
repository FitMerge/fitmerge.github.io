import { useEffect, useState } from 'react'
import Sheet from '../../components/Sheet'
import AddManualTab from './AddManualTab'
import AddPhotoTab from './AddPhotoTab'
import AddSearchTab from './AddSearchTab'
import QuickTab from './QuickTab'
import { useNutritionStore } from '../../store/nutrition'
import type { MealType, SavedMealItem } from '../../types'

type Tab = 'quick' | 'manual' | 'photo' | 'search'

const TABS: Tab[] = ['quick', 'manual', 'photo', 'search']

type AddFoodSheetProps = {
  open: boolean
  onClose: () => void
  date: string
  defaultMealType: MealType
}

export default function AddFoodSheet({ open, onClose, date, defaultMealType }: AddFoodSheetProps) {
  const hasEntries = useNutritionStore((s) => s.entries.length > 0)
  const [tab, setTab] = useState<Tab>('manual')
  const [prefill, setPrefill] = useState<SavedMealItem | null>(null)

  // Only reconsider the default tab when the sheet transitions open; hasEntries
  // changing while the sheet is already open shouldn't yank the user to a different tab.
  useEffect(() => {
    if (open) {
      setTab(hasEntries ? 'quick' : 'manual')
      setPrefill(null)
    }
    // (intentionally omitting hasEntries from deps — see comment above)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  function selectTab(t: Tab) {
    setPrefill(null)
    setTab(t)
  }

  function handlePrefill(item: SavedMealItem) {
    setPrefill(item)
    setTab('manual')
  }

  return (
    <Sheet open={open} onClose={onClose} title="Add food">
      <div className="flex gap-2 mb-4">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => selectTab(t)}
            className={`flex-1 rounded-lg py-2 text-sm capitalize ${
              tab === t ? 'bg-primary-500 text-slate-950 font-semibold' : 'bg-slate-800 text-slate-300'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'quick' && (
        <QuickTab date={date} defaultMealType={defaultMealType} onClose={onClose} onPrefill={handlePrefill} />
      )}
      {tab === 'manual' && (
        <AddManualTab
          date={date}
          defaultMealType={defaultMealType}
          initial={prefill ?? undefined}
          onClose={onClose}
        />
      )}
      {tab === 'photo' && <AddPhotoTab date={date} defaultMealType={defaultMealType} onClose={onClose} />}
      {tab === 'search' && <AddSearchTab date={date} defaultMealType={defaultMealType} onClose={onClose} />}
    </Sheet>
  )
}

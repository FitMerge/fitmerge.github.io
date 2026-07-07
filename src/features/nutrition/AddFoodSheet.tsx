import { useEffect, useState } from 'react'
import Sheet from '../../components/Sheet'
import AddManualTab from './AddManualTab'
import AddPhotoTab from './AddPhotoTab'
import AddSearchTab from './AddSearchTab'
import type { MealType } from '../../types'

type Tab = 'manual' | 'photo' | 'search'

const TABS: Tab[] = ['manual', 'photo', 'search']

type AddFoodSheetProps = {
  open: boolean
  onClose: () => void
  date: string
  defaultMealType: MealType
}

export default function AddFoodSheet({ open, onClose, date, defaultMealType }: AddFoodSheetProps) {
  const [tab, setTab] = useState<Tab>('manual')

  useEffect(() => {
    if (open) setTab('manual')
  }, [open])

  return (
    <Sheet open={open} onClose={onClose} title="Add food">
      <div className="flex gap-2 mb-4">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg py-2 text-sm capitalize ${
              tab === t ? 'bg-primary-500 text-slate-950 font-semibold' : 'bg-slate-800 text-slate-300'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'manual' && <AddManualTab date={date} defaultMealType={defaultMealType} onClose={onClose} />}
      {tab === 'photo' && <AddPhotoTab date={date} defaultMealType={defaultMealType} onClose={onClose} />}
      {tab === 'search' && <AddSearchTab />}
    </Sheet>
  )
}

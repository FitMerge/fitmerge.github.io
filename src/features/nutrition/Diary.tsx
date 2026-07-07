import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, UtensilsCrossed } from 'lucide-react'
import Card from '../../components/Card'
import RingChart from '../../components/RingChart'
import MacroBar from '../../components/MacroBar'
import EmptyState from '../../components/EmptyState'
import Button from '../../components/Button'
import Sheet from '../../components/Sheet'
import MealSection from './MealSection'
import AddFoodSheet from './AddFoodSheet'
import AddManualTab from './AddManualTab'
import { useNutritionStore, entriesForDate } from '../../store/nutrition'
import { useSettingsStore } from '../../store/settings'
import { addDays, isoToLabel, todayISO } from '../../lib/date'
import { macroPct, sumMacros } from '../../lib/macros'
import type { FoodEntry, MealType } from '../../types'

const MEALS: { type: MealType; label: string }[] = [
  { type: 'breakfast', label: 'Breakfast' },
  { type: 'lunch', label: 'Lunch' },
  { type: 'dinner', label: 'Dinner' },
  { type: 'snack', label: 'Snack' },
]

export default function Diary() {
  const [selectedDate, setSelectedDate] = useState(todayISO())
  const [addOpen, setAddOpen] = useState(false)
  const [addMealType, setAddMealType] = useState<MealType>('breakfast')
  const [editingEntry, setEditingEntry] = useState<FoodEntry | null>(null)

  const allEntries = useNutritionStore((s) => s.entries)
  const addEntry = useNutritionStore((s) => s.addEntry)
  const goals = useSettingsStore((s) => s.goals)

  const dayEntries = useMemo(() => entriesForDate(allEntries, selectedDate), [allEntries, selectedDate])
  const yesterdayISO = useMemo(() => addDays(selectedDate, -1), [selectedDate])
  const yesterdayEntries = useMemo(() => entriesForDate(allEntries, yesterdayISO), [allEntries, yesterdayISO])

  const totals = useMemo(() => sumMacros(dayEntries), [dayEntries])

  function openAdd(mealType: MealType) {
    setAddMealType(mealType)
    setAddOpen(true)
  }

  function copyYesterday() {
    for (const e of yesterdayEntries) {
      addEntry({
        date: selectedDate,
        mealType: e.mealType,
        name: e.name,
        qty: e.qty,
        unit: e.unit,
        calories: e.calories,
        protein: e.protein,
        carbs: e.carbs,
        fat: e.fat,
        source: e.source,
      })
    }
  }

  return (
    <div className="p-4 pb-24 space-y-4">
      <header className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setSelectedDate((d) => addDays(d, -1))}
          aria-label="Previous day"
          className="w-9 h-9 rounded-full bg-slate-800 active:bg-slate-700 flex items-center justify-center text-slate-300"
        >
          <ChevronLeft size={18} />
        </button>
        <h1 className="text-base font-semibold text-slate-100">
          {selectedDate === todayISO() ? 'Today' : isoToLabel(selectedDate)}
        </h1>
        <button
          type="button"
          onClick={() => setSelectedDate((d) => addDays(d, 1))}
          aria-label="Next day"
          className="w-9 h-9 rounded-full bg-slate-800 active:bg-slate-700 flex items-center justify-center text-slate-300"
        >
          <ChevronRight size={18} />
        </button>
      </header>

      <Card className="flex flex-col items-center gap-4">
        <RingChart
          value={macroPct(totals.calories, goals.calories)}
          label={`${Math.round(totals.calories)}`}
          sublabel={`of ${goals.calories} kcal`}
          color="#34d399"
        />
        <div className="w-full space-y-3">
          <MacroBar label="Protein" value={totals.protein} goal={goals.protein} color="bg-emerald-400" />
          <MacroBar label="Carbs" value={totals.carbs} goal={goals.carbs} color="bg-sky-400" />
          <MacroBar label="Fat" value={totals.fat} goal={goals.fat} color="bg-amber-400" />
        </div>
      </Card>

      {dayEntries.length === 0 ? (
        <EmptyState
          icon={UtensilsCrossed}
          title="No food logged yet"
          subtitle="Add your first meal for this day."
          action={
            <div className="flex flex-col gap-2 w-full">
              <Button variant="primary" full onClick={() => openAdd('breakfast')}>
                Add food
              </Button>
              {yesterdayEntries.length > 0 && (
                <Button variant="ghost" full onClick={copyYesterday}>
                  Copy yesterday
                </Button>
              )}
            </div>
          }
        />
      ) : (
        <div className="space-y-3">
          {MEALS.map(({ type, label }) => (
            <MealSection
              key={type}
              label={label}
              entries={dayEntries.filter((e) => e.mealType === type)}
              onAdd={() => openAdd(type)}
              onSelectEntry={(entry) => setEditingEntry(entry)}
            />
          ))}
        </div>
      )}

      <AddFoodSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        date={selectedDate}
        defaultMealType={addMealType}
      />

      <Sheet open={editingEntry !== null} onClose={() => setEditingEntry(null)} title="Edit food">
        {editingEntry && (
          <AddManualTab date={selectedDate} entry={editingEntry} onClose={() => setEditingEntry(null)} />
        )}
      </Sheet>
    </div>
  )
}

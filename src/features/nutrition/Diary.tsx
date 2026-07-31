import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import Card from '../../components/Card'
import MacroBar from '../../components/MacroBar'
import Button from '../../components/Button'
import Sheet from '../../components/Sheet'
import SegmentedControl from '../../components/SegmentedControl'
import MealSection from './MealSection'
import AddFoodSheet from './AddFoodSheet'
import AddManualTab from './AddManualTab'
import SaveMealSheet from './SaveMealSheet'
import WaterCard from './WaterCard'
import { useNutritionStore, entriesForDate } from '../../store/nutrition'
import { useWorkoutsStore } from '../../store/workouts'
import { useBodyStore } from '../../store/body'
import { useSettingsStore } from '../../store/settings'
import { burnedCaloriesForDate, latestBodyWeightKg } from '../../lib/exercise'
import { addDays, isoToLabel, todayISO } from '../../lib/date'
import { macroPct, sumMacros } from '../../lib/macros'
import { RANGE_OPTIONS, type RangeKey } from '../progress/utils'
import type { FoodEntry, MealType } from '../../types'

// Trends pull in Recharts; lazy so the Diet chunk stays light until the tab is
// actually opened (same reasoning as the route-level splits in App.tsx).
const CaloriesSection = lazy(() => import('../progress/CaloriesSection'))
const MacroAveragesSection = lazy(() => import('../progress/MacroAveragesSection'))

const MEALS: { type: MealType; label: string }[] = [
  { type: 'breakfast', label: 'Breakfast' },
  { type: 'lunch', label: 'Lunch' },
  { type: 'dinner', label: 'Dinner' },
  { type: 'snack', label: 'Snack' },
]

// Short "Mon DD" label for default saved-meal names, kept local to avoid
// touching lib/date.ts (out of scope for this phase).
function shortDateLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, (m ?? 1) - 1, d ?? 1)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

type DietView = 'today' | 'trends'

const VIEW_OPTIONS = [
  { key: 'today' as const, label: 'Today' },
  { key: 'trends' as const, label: 'Trends' },
]

export default function Diary() {
  const [view, setView] = useState<DietView>('today')
  const [trendsRange, setTrendsRange] = useState<RangeKey>('30d')
  const [selectedDate, setSelectedDate] = useState(todayISO())
  const [addOpen, setAddOpen] = useState(false)
  const [addMealType, setAddMealType] = useState<MealType>('breakfast')
  const [editingEntry, setEditingEntry] = useState<FoodEntry | null>(null)
  const [savingMealType, setSavingMealType] = useState<MealType | null>(null)

  const allEntries = useNutritionStore((s) => s.entries)
  const addEntry = useNutritionStore((s) => s.addEntry)
  const goals = useSettingsStore((s) => s.goals)

  const dayEntries = useMemo(() => entriesForDate(allEntries, selectedDate), [allEntries, selectedDate])
  const yesterdayISO = useMemo(() => addDays(selectedDate, -1), [selectedDate])
  const yesterdayEntries = useMemo(() => entriesForDate(allEntries, yesterdayISO), [allEntries, yesterdayISO])

  const totals = useMemo(() => sumMacros(dayEntries), [dayEntries])

  // MyFitnessPal-style budget: calories remaining = goal − food + exercise burned.
  const exerciseByDate = useNutritionStore((s) => s.exercise)
  const sessions = useWorkoutsStore((s) => s.sessions)
  const bodyEntries = useBodyStore((s) => s.entries)
  const burned = useMemo(
    () => burnedCaloriesForDate(selectedDate, exerciseByDate, sessions, latestBodyWeightKg(bodyEntries)),
    [selectedDate, exerciseByDate, sessions, bodyEntries],
  )
  const remaining = Math.round(goals.calories - totals.calories + burned)
  const extrasSummary = useMemo(() => {
    const fiber = dayEntries.reduce((sum, e) => sum + (e.fiber ?? 0), 0)
    const sugar = dayEntries.reduce((sum, e) => sum + (e.sugar ?? 0), 0)
    const sodium = dayEntries.reduce((sum, e) => sum + (e.sodium ?? 0), 0)
    // Show a decimal for trace amounts so a real sub-1 value isn't misread as "0".
    const fmt = (n: number) => (n >= 1 ? String(Math.round(n)) : n.toFixed(1))
    const parts: string[] = []
    if (fiber > 0) parts.push(`Fiber ${fmt(fiber)} g`)
    if (sugar > 0) parts.push(`Sugar ${fmt(sugar)} g`)
    if (sodium > 0) parts.push(`Sodium ${fmt(sodium)} mg`)
    return parts.join(' · ')
  }, [dayEntries])

  function openAdd(mealType: MealType) {
    setAddMealType(mealType)
    setAddOpen(true)
  }

  // The nav's center "+" routes here with { openAdd } — open the add screen on the
  // meal that fits the current time of day (breakfast/lunch/dinner/snack).
  const location = useLocation()
  const navigate = useNavigate()
  useEffect(() => {
    const st = location.state as { openAdd?: boolean } | null
    if (!st?.openAdd) return
    const h = new Date().getHours()
    const meal: MealType = h < 11 ? 'breakfast' : h < 16 ? 'lunch' : h < 21 ? 'dinner' : 'snack'
    setView('today')
    setSelectedDate(todayISO())
    openAdd(meal)
    navigate('.', { replace: true, state: null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state])

  const savingMeal = MEALS.find((m) => m.type === savingMealType)
  const savingEntries = useMemo(
    () => (savingMealType ? dayEntries.filter((e) => e.mealType === savingMealType) : []),
    [dayEntries, savingMealType],
  )

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

  if (view === 'trends') {
    return (
      <div className="p-4 pb-24 space-y-4">
        <SegmentedControl options={VIEW_OPTIONS} value={view} onChange={setView} ariaLabel="Diet view" />
        <SegmentedControl
          size="sm"
          options={RANGE_OPTIONS}
          value={trendsRange}
          onChange={setTrendsRange}
          ariaLabel="Trends range"
        />
        <Suspense
          fallback={
            <div className="flex justify-center py-16">
              <Loader2 size={24} className="animate-spin text-emerald-400" />
            </div>
          }
        >
          <CaloriesSection range={trendsRange} />
          <MacroAveragesSection range={trendsRange} />
        </Suspense>
      </div>
    )
  }

  return (
    <div className="p-4 pb-24 space-y-4">
      <SegmentedControl options={VIEW_OPTIONS} value={view} onChange={setView} ariaLabel="Diet view" />

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

      {/* Compact calorie summary — "Remaining" is the number that matters most, so
          it leads (MyFitnessPal's Goal − Food + Exercise = Remaining), backed by a
          slim progress bar. Keeping this short lets the meals sit near the top. */}
      <Card className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {remaining >= 0 ? 'Remaining' : 'Over'}
            </p>
            <p className={`text-3xl font-bold leading-tight ${remaining < 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {Math.abs(remaining).toLocaleString()}
              <span className="ml-1 text-sm font-medium text-slate-500">kcal</span>
            </p>
          </div>
          <div className="text-right text-xs leading-relaxed text-slate-400">
            <p>{Math.round(goals.calories).toLocaleString()} goal</p>
            <p>− {Math.round(totals.calories).toLocaleString()} food</p>
            {burned > 0 && <p className="text-emerald-400/80">+ {burned.toLocaleString()} exercise</p>}
          </div>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-slate-800">
          <div
            className={`h-full rounded-full ${totals.calories > goals.calories ? 'bg-amber-400' : 'bg-emerald-400'}`}
            style={{ width: `${Math.min(100, macroPct(totals.calories, goals.calories) * 100)}%` }}
          />
        </div>

        <div className="space-y-2 pt-1">
          <MacroBar label="Protein" value={totals.protein} goal={goals.protein} color="bg-emerald-400" />
          <MacroBar label="Carbs" value={totals.carbs} goal={goals.carbs} color="bg-sky-400" />
          <MacroBar label="Fat" value={totals.fat} goal={goals.fat} color="bg-amber-400" />
        </div>
        {extrasSummary && <p className="text-xs text-slate-500">{extrasSummary}</p>}
      </Card>

      {/* Food comes first — MyFitnessPal's "Today" layout keeps the meals right
          under the calorie summary so logging is never more than a scroll away.
          Every meal is always shown (even empty) with its own Add-food button. */}
      <div className="space-y-3">
        {MEALS.map(({ type, label }) => (
          <MealSection
            key={type}
            label={label}
            entries={dayEntries.filter((e) => e.mealType === type)}
            onAdd={() => openAdd(type)}
            onSelectEntry={(entry) => setEditingEntry(entry)}
            onSaveMeal={() => setSavingMealType(type)}
          />
        ))}
      </div>

      {dayEntries.length === 0 && yesterdayEntries.length > 0 && (
        <Button variant="ghost" full onClick={copyYesterday}>
          Copy yesterday's food
        </Button>
      )}

      {/* Water sits below the food log — quick to reach, but not in the way of
          the primary task. Exercise moved out to the training surface; burned
          calories still show in the summary above. */}
      <WaterCard date={selectedDate} />

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

      <SaveMealSheet
        open={savingMealType !== null}
        onClose={() => setSavingMealType(null)}
        mealLabel={savingMeal?.label ?? ''}
        dateLabel={shortDateLabel(selectedDate)}
        entries={savingEntries}
      />
    </div>
  )
}

import { useMemo, useState } from 'react'
import { History, Plus, Trash2 } from 'lucide-react'
import Card from '../../components/Card'
import EmptyState from '../../components/EmptyState'
import { frequentFoods, recentFoods, useNutritionStore } from '../../store/nutrition'
import type { MealType, SavedMeal, SavedMealItem } from '../../types'

type QuickTabProps = {
  date: string
  defaultMealType: MealType
  onClose: () => void
  onPrefill: (item: SavedMealItem) => void
}

export default function QuickTab({ date, defaultMealType, onClose, onPrefill }: QuickTabProps) {
  const entries = useNutritionStore((s) => s.entries)
  const savedMeals = useNutritionStore((s) => s.savedMeals)
  const addEntry = useNutritionStore((s) => s.addEntry)
  const removeSavedMeal = useNutritionStore((s) => s.removeSavedMeal)

  const recentItems = useMemo(() => recentFoods(entries), [entries])
  const frequentItems = useMemo(() => {
    const recentNames = new Set(recentItems.map((i) => i.name.trim().toLowerCase()))
    return frequentFoods(entries).filter((i) => !recentNames.has(i.name.trim().toLowerCase()))
  }, [entries, recentItems])

  function logItem(item: SavedMealItem) {
    addEntry({
      date,
      mealType: defaultMealType,
      name: item.name,
      qty: item.qty,
      unit: item.unit,
      calories: item.calories,
      protein: item.protein,
      carbs: item.carbs,
      fat: item.fat,
      source: 'manual',
    })
    onClose()
  }

  function logSavedMeal(meal: SavedMeal) {
    for (const item of meal.items) {
      addEntry({
        date,
        mealType: defaultMealType,
        name: item.name,
        qty: item.qty,
        unit: item.unit,
        calories: item.calories,
        protein: item.protein,
        carbs: item.carbs,
        fat: item.fat,
        source: 'manual',
      })
    }
    onClose()
  }

  const hasAnything = savedMeals.length > 0 || recentItems.length > 0 || frequentItems.length > 0

  if (!hasAnything) {
    return (
      <EmptyState
        icon={History}
        title="Nothing to re-log yet"
        subtitle="Log foods once and they'll appear here for one-tap re-logging."
      />
    )
  }

  return (
    <div className="space-y-5">
      {savedMeals.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-300">Saved meals</h3>
          <div className="space-y-2">
            {savedMeals.map((meal) => (
              <SavedMealRow
                key={meal.id}
                meal={meal}
                onLog={() => logSavedMeal(meal)}
                onRemove={() => removeSavedMeal(meal.id)}
              />
            ))}
          </div>
        </section>
      )}

      {recentItems.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-300">Recent</h3>
          <div className="space-y-2">
            {recentItems.map((item) => (
              <QuickFoodRow
                key={item.name}
                item={item}
                onLog={() => logItem(item)}
                onPrefill={() => onPrefill(item)}
              />
            ))}
          </div>
        </section>
      )}

      {frequentItems.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-300">Frequent</h3>
          <div className="space-y-2">
            {frequentItems.map((item) => (
              <QuickFoodRow
                key={item.name}
                item={item}
                onLog={() => logItem(item)}
                onPrefill={() => onPrefill(item)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

type QuickFoodRowProps = {
  item: SavedMealItem
  onLog: () => void
  onPrefill: () => void
}

function QuickFoodRow({ item, onLog, onPrefill }: QuickFoodRowProps) {
  return (
    <Card className="p-3 flex items-center gap-3 active:bg-slate-800/60" onClick={onPrefill}>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-100">{item.name}</p>
        <p className="truncate text-xs text-slate-500">
          {item.qty} {item.unit} · {Math.round(item.calories)} kcal
        </p>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onLog()
        }}
        aria-label={`Add ${item.name}`}
        className="shrink-0 w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center active:bg-emerald-500/20"
      >
        <Plus size={16} />
      </button>
    </Card>
  )
}

type SavedMealRowProps = {
  meal: SavedMeal
  onLog: () => void
  onRemove: () => void
}

function SavedMealRow({ meal, onLog, onRemove }: SavedMealRowProps) {
  const [confirming, setConfirming] = useState(false)
  const totalKcal = meal.items.reduce((sum, i) => sum + i.calories, 0)

  return (
    <Card className="p-3 flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-100">{meal.name}</p>
        <p className="truncate text-xs text-slate-500">
          {meal.items.length} item{meal.items.length === 1 ? '' : 's'} · {Math.round(totalKcal)} kcal
        </p>
      </div>
      <button
        type="button"
        onClick={() => {
          if (confirming) {
            onRemove()
          } else {
            setConfirming(true)
          }
        }}
        onBlur={() => setConfirming(false)}
        aria-label={confirming ? `Confirm remove ${meal.name}` : `Remove ${meal.name}`}
        className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          confirming ? 'bg-red-500/20 text-red-400' : 'bg-slate-800 text-slate-400'
        }`}
      >
        <Trash2 size={14} />
      </button>
      <button
        type="button"
        onClick={onLog}
        aria-label={`Add ${meal.name}`}
        className="shrink-0 w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center active:bg-emerald-500/20"
      >
        <Plus size={16} />
      </button>
    </Card>
  )
}

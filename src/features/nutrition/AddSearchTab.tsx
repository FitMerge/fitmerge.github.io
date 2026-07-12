import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Loader2, PencilLine, Plus, ScanBarcode, Search, Trash2 } from 'lucide-react'
import Button from '../../components/Button'
import Card from '../../components/Card'
import EmptyState from '../../components/EmptyState'
import BarcodeScanSheet from './BarcodeScanSheet'
import FoodDetailPanel from './FoodDetailPanel'
import SearchResultRow from './SearchResultRow'
import { searchFoods } from '../../services/foodSearch/openFoodFacts'
import type { SearchFood } from '../../services/foodSearch/openFoodFacts'
import { searchCommonFoods, loadCommonFoods, commonFoodsReady } from '../../services/foodSearch/commonFoods'
import { searchUsdaFoods, UsdaRateLimitError } from '../../services/foodSearch/usda'
import { frequentFoods, recentFoods, useNutritionStore } from '../../store/nutrition'
import { useSettingsStore } from '../../store/settings'
import type { CustomFood, Macros, MealType, SavedMeal, SavedMealItem } from '../../types'

const DEBOUNCE_MS = 400

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

type SelectedFood = {
  name: string
  brand?: string
  servingText: string
  per100g?: Macros
  perServing?: Macros
  extras100g?: SearchFood['extras100g']
  extrasServing?: SearchFood['extrasServing']
  isCustom: boolean
}

type AddSearchTabProps = {
  date: string
  mealType: MealType
  onClose: () => void
  onManual?: () => void
}

export default function AddSearchTab({ date, mealType, onClose, onManual }: AddSearchTabProps) {
  const customFoods = useNutritionStore((s) => s.customFoods)
  const entries = useNutritionStore((s) => s.entries)
  const savedMeals = useNutritionStore((s) => s.savedMeals)
  const addEntry = useNutritionStore((s) => s.addEntry)
  const removeSavedMeal = useNutritionStore((s) => s.removeSavedMeal)
  const usdaApiKey = useSettingsStore((s) => s.usdaApiKey)

  const [query, setQuery] = useState('')
  const [brandedResults, setBrandedResults] = useState<SearchFood[]>([])
  const [usdaResults, setUsdaResults] = useState<SearchFood[]>([])
  const [usdaRateLimited, setUsdaRateLimited] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [retryCount, setRetryCount] = useState(0)
  const [selected, setSelected] = useState<SelectedFood | null>(null)
  const [scanning, setScanning] = useState(false)
  const [justAdded, setJustAdded] = useState<Set<string>>(new Set())

  const inputRef = useRef<HTMLInputElement>(null)
  const [foodsReady, setFoodsReady] = useState(commonFoodsReady())

  useEffect(() => {
    let active = true
    void loadCommonFoods().then(() => {
      if (active) setFoodsReady(true)
    })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const trimmed = query.trim()
    if (!trimmed) {
      setBrandedResults([])
      setUsdaResults([])
      setUsdaRateLimited(false)
      setError('')
      setLoading(false)
      return
    }
    const controller = new AbortController()
    setLoading(true)
    setError('')
    const timer = setTimeout(() => {
      searchUsdaFoods(trimmed, controller.signal, usdaApiKey)
        .then((foods) => {
          setUsdaResults(foods)
          setUsdaRateLimited(false)
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === 'AbortError') return
          setUsdaResults([])
          setUsdaRateLimited(err instanceof UsdaRateLimitError)
        })
      searchFoods(trimmed, controller.signal)
        .then((foods) => {
          setBrandedResults(foods)
          setLoading(false)
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === 'AbortError') return
          setError(err instanceof Error ? err.message : 'Something went wrong searching for food')
          setLoading(false)
        })
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query, retryCount, usdaApiKey])

  const commonResults = useMemo(() => searchCommonFoods(query), [query, foodsReady])

  const recentItems = useMemo(() => recentFoods(entries), [entries])
  const frequentItems = useMemo(() => {
    const recentNames = new Set(recentItems.map((i) => i.name.trim().toLowerCase()))
    return frequentFoods(entries).filter((i) => !recentNames.has(i.name.trim().toLowerCase()))
  }, [entries, recentItems])

  function markAdded(key: string) {
    setJustAdded((prev) => new Set(prev).add(key))
  }

  // --- one-tap quick logging (does not close, so a whole meal can be added) ---
  function quickAddSearchFood(food: SearchFood, key: string) {
    const hasServing = food.perServing !== undefined
    const macros = hasServing ? food.perServing! : food.per100g
    const ex = hasServing ? food.extrasServing : food.extras100g
    addEntry({
      date,
      mealType,
      name: food.brand ? `${food.name} (${food.brand})` : food.name,
      qty: hasServing ? 1 : 100,
      unit: hasServing ? food.servingText : 'g',
      calories: round1(macros.calories),
      protein: round1(macros.protein),
      carbs: round1(macros.carbs),
      fat: round1(macros.fat),
      fiber: ex?.fiber !== undefined && ex.fiber > 0 ? round1(ex.fiber) : undefined,
      sugar: ex?.sugar !== undefined && ex.sugar > 0 ? round1(ex.sugar) : undefined,
      sodium: ex?.sodiumMg !== undefined && ex.sodiumMg > 0 ? Math.round(ex.sodiumMg) : undefined,
      source: 'search',
    })
    markAdded(key)
  }

  function quickAddCustom(food: CustomFood) {
    addEntry({
      date,
      mealType,
      name: food.brand ? `${food.name} (${food.brand})` : food.name,
      qty: 1,
      unit: food.serving,
      calories: round1(food.per.calories),
      protein: round1(food.per.protein),
      carbs: round1(food.per.carbs),
      fat: round1(food.per.fat),
      source: 'manual',
    })
    markAdded(`cf-${food.id}`)
  }

  function quickAddItem(item: SavedMealItem, key: string) {
    addEntry({
      date,
      mealType,
      name: item.name,
      qty: item.qty,
      unit: item.unit,
      calories: item.calories,
      protein: item.protein,
      carbs: item.carbs,
      fat: item.fat,
      source: 'manual',
    })
    markAdded(key)
  }

  function logSavedMeal(meal: SavedMeal) {
    for (const item of meal.items) {
      addEntry({
        date,
        mealType,
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
    markAdded(`meal-${meal.id}`)
  }

  function selectSearchFood(food: SearchFood) {
    setSelected({
      name: food.name,
      brand: food.brand,
      servingText: food.servingText,
      per100g: food.per100g,
      perServing: food.perServing,
      extras100g: food.extras100g,
      extrasServing: food.extrasServing,
      isCustom: false,
    })
  }

  function selectCustomFood(food: CustomFood) {
    setSelected({
      name: food.name,
      brand: food.brand,
      servingText: food.serving,
      per100g: undefined,
      perServing: food.per,
      isCustom: true,
    })
  }

  if (selected) {
    return (
      <FoodDetailPanel
        name={selected.name}
        brand={selected.brand}
        servingText={selected.servingText}
        per100g={selected.per100g}
        perServing={selected.perServing}
        extras100g={selected.extras100g}
        extrasServing={selected.extrasServing}
        date={date}
        defaultMealType={mealType}
        allowSaveToMyFoods={!selected.isCustom}
        onClose={onClose}
        onBack={() => setSelected(null)}
      />
    )
  }

  if (scanning) {
    return (
      <BarcodeScanSheet
        onBack={() => setScanning(false)}
        onFound={(food) => {
          setScanning(false)
          selectSearchFood(food)
        }}
      />
    )
  }

  const trimmedQuery = query.trim()
  const hasHistory = savedMeals.length > 0 || recentItems.length > 0 || frequentItems.length > 0

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for a food"
            className="w-full bg-slate-800 rounded-lg pl-9 pr-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <button
          type="button"
          onClick={() => setScanning(true)}
          aria-label="Scan barcode"
          className="shrink-0 rounded-lg bg-slate-800 px-3 text-slate-300 active:bg-slate-700 flex items-center"
        >
          <ScanBarcode size={18} />
        </button>
      </div>

      {/* Empty query → MyFitnessPal-style "History": saved meals, recent, frequent, my foods. */}
      {!trimmedQuery && (
        <div className="space-y-5">
          {savedMeals.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-300">Saved meals</h3>
              <div className="space-y-2">
                {savedMeals.map((meal) => (
                  <SavedMealRow
                    key={meal.id}
                    meal={meal}
                    added={justAdded.has(`meal-${meal.id}`)}
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
                {recentItems.map((item) => {
                  const key = `recent-${item.name}`
                  return (
                    <SearchResultRow
                      key={key}
                      name={item.name}
                      subtitle={`${item.qty} ${item.unit}`}
                      calorieLabel={`${Math.round(item.calories)} kcal`}
                      onClick={() => quickAddItem(item, key)}
                      onQuickAdd={() => quickAddItem(item, key)}
                      added={justAdded.has(key)}
                    />
                  )
                })}
              </div>
            </section>
          )}

          {frequentItems.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-300">Frequent</h3>
              <div className="space-y-2">
                {frequentItems.map((item) => {
                  const key = `freq-${item.name}`
                  return (
                    <SearchResultRow
                      key={key}
                      name={item.name}
                      subtitle={`${item.qty} ${item.unit}`}
                      calorieLabel={`${Math.round(item.calories)} kcal`}
                      onClick={() => quickAddItem(item, key)}
                      onQuickAdd={() => quickAddItem(item, key)}
                      added={justAdded.has(key)}
                    />
                  )
                })}
              </div>
            </section>
          )}

          {customFoods.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-300">My foods</h3>
              <div className="space-y-2">
                {customFoods.map((food) => (
                  <SearchResultRow
                    key={food.id}
                    name={food.name}
                    brand={food.brand}
                    subtitle={food.serving}
                    calorieLabel={`${Math.round(food.per.calories)} kcal`}
                    onClick={() => selectCustomFood(food)}
                    onQuickAdd={() => quickAddCustom(food)}
                    added={justAdded.has(`cf-${food.id}`)}
                  />
                ))}
              </div>
            </section>
          )}

          {onManual && (
            <button
              type="button"
              onClick={onManual}
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-dashed border-slate-700 py-3 text-sm text-slate-300 active:bg-slate-800/60"
            >
              <PencilLine size={16} />
              {hasHistory ? 'Create a food' : 'Quick add / create a food'}
            </button>
          )}

          {!hasHistory && (
            <p className="text-center text-xs text-slate-500">
              Search above, scan a barcode, or create a food — anything you log shows up here for
              one-tap re-logging.
            </p>
          )}
        </div>
      )}

      {trimmedQuery && commonResults.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-300">Common foods</h3>
          <div className="space-y-2">
            {commonResults.map((food) => (
              <SearchResultRow
                key={food.id}
                name={food.name}
                brand={food.brand}
                subtitle={food.servingText}
                calorieLabel={`${Math.round((food.perServing ?? food.per100g).calories)} kcal`}
                onClick={() => selectSearchFood(food)}
                onQuickAdd={() => quickAddSearchFood(food, food.id)}
                added={justAdded.has(food.id)}
              />
            ))}
          </div>
        </div>
      )}

      {trimmedQuery && usdaResults.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-300">Generic foods (USDA)</h3>
          <div className="space-y-2">
            {usdaResults.map((food) => (
              <SearchResultRow
                key={food.id}
                name={food.name}
                subtitle={food.servingText}
                calorieLabel={`${Math.round((food.perServing ?? food.per100g).calories)} kcal`}
                onClick={() => selectSearchFood(food)}
                onQuickAdd={() => quickAddSearchFood(food, food.id)}
                added={justAdded.has(food.id)}
              />
            ))}
          </div>
        </div>
      )}

      {trimmedQuery && usdaRateLimited && usdaResults.length === 0 && (
        <p className="text-xs text-slate-500">
          USDA search is temporarily rate-limited. Add a free USDA key in Settings for unlimited
          generic-food search.
        </p>
      )}

      {trimmedQuery && (loading || error || brandedResults.length > 0 || commonResults.length > 0) && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-300">Branded</h3>

          {loading &&
            (commonResults.length > 0 ? (
              <p className="text-sm text-slate-500">Searching online database…</p>
            ) : (
              <div className="flex justify-center py-8">
                <Loader2 size={28} className="animate-spin text-primary-400" />
              </div>
            ))}

          {!loading &&
            error &&
            (commonResults.length > 0 ? (
              <p className="text-sm text-slate-500">
                Online food database unavailable.{' '}
                <button
                  type="button"
                  onClick={() => setRetryCount((n) => n + 1)}
                  className="text-emerald-400 underline"
                >
                  Retry
                </button>
              </p>
            ) : (
              <div className="space-y-3">
                <EmptyState icon={Search} title="Search failed" subtitle={error} />
                <Button variant="ghost" full onClick={() => setRetryCount((n) => n + 1)}>
                  Retry
                </Button>
              </div>
            ))}

          {!loading && !error && brandedResults.length === 0 && commonResults.length > 0 && (
            <p className="text-sm text-slate-500">No branded results for "{trimmedQuery}"</p>
          )}

          {!loading && !error && brandedResults.length > 0 && (
            <div className="space-y-2">
              {brandedResults.map((food) => (
                <SearchResultRow
                  key={food.id}
                  name={food.name}
                  brand={food.brand}
                  subtitle={food.servingText}
                  calorieLabel={`${Math.round(food.per100g.calories)} kcal /100g`}
                  onClick={() => selectSearchFood(food)}
                  onQuickAdd={() => quickAddSearchFood(food, food.id)}
                  added={justAdded.has(food.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {trimmedQuery &&
        !loading &&
        !error &&
        commonResults.length === 0 &&
        usdaResults.length === 0 &&
        brandedResults.length === 0 && (
          <div className="space-y-3">
            <EmptyState icon={Search} title="No foods found" subtitle={`No results for "${trimmedQuery}"`} />
            {onManual && (
              <button
                type="button"
                onClick={onManual}
                className="w-full flex items-center justify-center gap-2 rounded-lg border border-dashed border-slate-700 py-3 text-sm text-slate-300 active:bg-slate-800/60"
              >
                <PencilLine size={16} />
                Create "{trimmedQuery}"
              </button>
            )}
          </div>
        )}
    </div>
  )
}

type SavedMealRowProps = {
  meal: SavedMeal
  added: boolean
  onLog: () => void
  onRemove: () => void
}

function SavedMealRow({ meal, added, onLog, onRemove }: SavedMealRowProps) {
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
        onClick={() => (confirming ? onRemove() : setConfirming(true))}
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
        aria-label={added ? `${meal.name} added` : `Add ${meal.name}`}
        className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${
          added ? 'bg-emerald-500 text-slate-950' : 'bg-emerald-500/10 text-emerald-400 active:bg-emerald-500/20'
        }`}
      >
        {added ? <Check size={16} strokeWidth={3} /> : <Plus size={18} />}
      </button>
    </Card>
  )
}

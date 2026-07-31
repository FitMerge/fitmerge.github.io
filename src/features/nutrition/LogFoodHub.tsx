// One box. Everything else is a consequence of what is in it.
//
// Logging food used to open a screen with six competing ways in: a "describe your
// meal" card, an "add a previous meal" card, the search box, Quick add, Photo and
// Create a food. The first two were separate screens with their own text fields —
// so you had to choose a lane before you had typed a word, and choosing wrong
// meant typing it again somewhere else.
//
// Now there is one input and it does not care what you put in it. Type a product
// name and you get database rows; type a sentence and you get the breakdown; type
// nothing and you get what you have eaten before. The AI is not a mode you enter,
// it is one of the answers that can come back.

import { useMemo, useState } from 'react'
import { Camera, Check, Loader2, PencilLine, Plus, ScanBarcode, Search, Trash2, Wand2, Zap } from 'lucide-react'
import Button from '../../components/Button'
import Card from '../../components/Card'
import EmptyState from '../../components/EmptyState'
import BarcodeScanSheet from './BarcodeScanSheet'
import DescribeResults from './DescribeResults'
import FoodDetailPanel from './FoodDetailPanel'
import PreviousMealDetail from './PreviousMealDetail'
import PreviousMealsSection from './PreviousMealsSection'
import SearchResultRow from './SearchResultRow'
import { looksLikeMeal } from './looksLikeMeal'
import { pastMeals, type PastMeal } from './pastMeals'
import { useFoodSearch } from './useFoodSearch'
import type { SearchFood } from '../../services/foodSearch/openFoodFacts'
import { frequentFoods, recentFoods, useNutritionStore } from '../../store/nutrition'
import type { CustomFood, Macros, MealType, SavedMeal, SavedMealItem } from '../../types'

/** "40 g" rather than "1 40 g" — the quantity is only worth printing when it is
 * not one, because the unit already carries the portion for a logged food. */
function portionLabel(item: { qty: number; unit: string }): string {
  return item.qty === 1 ? item.unit : `${item.qty} × ${item.unit}`
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

const MEAL_LABEL: Record<MealType, string> = {
  breakfast: 'breakfast',
  lunch: 'lunch',
  dinner: 'dinner',
  snack: 'snacks',
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
  defaultQty?: number
}

type Props = {
  date: string
  mealType: MealType
  onClose: () => void
  onManual: () => void
  onPhoto: () => void
  onQuickAdd: () => void
}

export default function LogFoodHub({
  date,
  mealType,
  onClose,
  onManual,
  onPhoto,
  onQuickAdd,
}: Props) {
  const entries = useNutritionStore((s) => s.entries)
  const customFoods = useNutritionStore((s) => s.customFoods)
  const savedMeals = useNutritionStore((s) => s.savedMeals)
  const addEntry = useNutritionStore((s) => s.addEntry)
  const removeSavedMeal = useNutritionStore((s) => s.removeSavedMeal)

  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<SelectedFood | null>(null)
  const [scanning, setScanning] = useState(false)
  const [justAdded, setJustAdded] = useState<Set<string>>(new Set())
  // The sentence currently being broken down, frozen at the moment you asked.
  // Null means the box is behaving as a search box.
  const [describeText, setDescribeText] = useState<string | null>(null)
  const [openMeal, setOpenMeal] = useState<PastMeal | null>(null)

  const results = useFoodSearch(describeText === null ? query : '')

  const meals = useMemo(
    () => pastMeals(entries, mealType, { excludeDate: date }),
    [entries, mealType, date],
  )
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

  // Tapping a recent/frequent/history row opens its detail at the remembered
  // portion; the row's "+" still logs it in one tap.
  function selectRecentItem(item: SavedMealItem) {
    const q = item.qty > 0 ? item.qty : 1
    setSelected({
      name: item.name,
      servingText: item.unit,
      perServing: {
        calories: item.calories / q,
        protein: item.protein / q,
        carbs: item.carbs / q,
        fat: item.fat / q,
      },
      isCustom: true,
      defaultQty: q,
    })
  }

  function selectCustomFood(food: CustomFood) {
    setSelected({
      name: food.name,
      brand: food.brand,
      servingText: food.serving,
      perServing: food.per,
      isCustom: true,
    })
  }

  // --- full-page takeovers -------------------------------------------------

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
        defaultQty={selected.defaultQty}
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

  if (openMeal) {
    return (
      <PreviousMealDetail
        meal={openMeal}
        date={date}
        mealType={mealType}
        mealLabel={MEAL_LABEL[mealType]}
        onBack={() => setOpenMeal(null)}
        onDone={onClose}
      />
    )
  }

  // --- the hub -------------------------------------------------------------

  const trimmed = query.trim()
  const showAiFirst = describeText === null && trimmed !== '' && looksLikeMeal(trimmed)
  const hasHistory =
    meals.length > 0 || savedMeals.length > 0 || recentItems.length > 0 || frequentItems.length > 0

  const aiCard = (
    <button
      type="button"
      onClick={() => setDescribeText(trimmed)}
      className="flex w-full items-center gap-3 rounded-xl bg-gradient-to-br from-primary-500/20 to-slate-900 p-3 text-left active:opacity-80"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-500/20">
        <Wand2 size={17} className="text-primary-300" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-bold text-primary-200">Log this as a meal</span>
        <span className="mt-0.5 block truncate text-xs text-slate-300">
          Break “{trimmed}” into items and macros
        </span>
      </span>
    </button>
  )

  return (
    <div className="space-y-4">
      {/* The one input. Barcode and camera sit inside it because they are other
          ways of SAYING the same thing, not other places to go. */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              // Typing again is a new question. Keep the breakdown until they ask
              // for a re-run, but drop it the moment the box is emptied.
              if (!e.target.value.trim()) setDescribeText(null)
            }}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return
              e.preventDefault()
              const q = query.trim()
              // A described meal ("4 eggs and 2 toast") runs the AI breakdown on
              // Enter, instead of making you reach for the "Log this as a meal"
              // card below. A plain product name has nothing to break down, so
              // Enter just dismisses the keyboard and the live search shows.
              if (q && looksLikeMeal(q)) setDescribeText(q)
              e.currentTarget.blur()
            }}
            enterKeyHint="search"
            placeholder="Tell FitMerge what you ate"
            className="w-full bg-slate-800 rounded-lg pl-9 pr-3 py-2.5 text-base text-slate-100 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <button
          type="button"
          onClick={() => setScanning(true)}
          aria-label="Scan barcode"
          className="flex shrink-0 items-center rounded-lg bg-slate-800 px-3 text-slate-300 active:bg-slate-700"
        >
          <ScanBarcode size={18} />
        </button>
        <button
          type="button"
          onClick={onPhoto}
          aria-label="Log from a photo"
          className="flex shrink-0 items-center rounded-lg bg-slate-800 px-3 text-slate-300 active:bg-slate-700"
        >
          <Camera size={18} />
        </button>
      </div>

      {/* The AI breakdown, in place, with the sentence still up in the box. */}
      {describeText !== null && (
        <>
          <button
            type="button"
            onClick={() => setDescribeText(null)}
            className="text-xs font-medium text-slate-400 active:text-slate-200"
          >
            ← Back to search results
          </button>
          <DescribeResults
            key={describeText}
            text={describeText}
            currentText={query}
            date={date}
            mealType={mealType}
            onClose={onClose}
            onRedo={(next) => setDescribeText(next)}
          />
        </>
      )}

      {describeText === null && (
        <>
          {/* Meal-ish text goes above the rows, because for a described meal none
              of them are the answer. Anything else gets the offer underneath. */}
          {showAiFirst && aiCard}

          {/* Empty box → what you have eaten before. */}
          {!trimmed && (
            <div className="space-y-5">
              <PreviousMealsSection meals={meals} onOpen={setOpenMeal} />

              {savedMeals.length > 0 && (
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold text-slate-300">Saved meals</h3>
                  {savedMeals.map((meal) => (
                    <SavedMealRow
                      key={meal.id}
                      meal={meal}
                      added={justAdded.has(`meal-${meal.id}`)}
                      onLog={() => logSavedMeal(meal)}
                      onRemove={() => removeSavedMeal(meal.id)}
                    />
                  ))}
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
                          subtitle={portionLabel(item)}
                          calorieLabel={`${Math.round(item.calories)} kcal`}
                          onClick={() => selectRecentItem(item)}
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
                          subtitle={portionLabel(item)}
                          calorieLabel={`${Math.round(item.calories)} kcal`}
                          onClick={() => selectRecentItem(item)}
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

              {!hasHistory && (
                <p className="text-center text-xs text-slate-500">
                  Type what you ate, scan a barcode, or snap a photo — anything you log shows up
                  here for one-tap re-logging.
                </p>
              )}
            </div>
          )}

          {/* Above every database: things you have actually eaten. */}
          {trimmed && results.history.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-300">You've logged this</h3>
              <div className="space-y-2">
                {results.history.map((hit) => (
                  <SearchResultRow
                    key={`history-${hit.item.name}`}
                    name={hit.item.name}
                    subtitle={
                      hit.reason === 'custom'
                        ? `My foods · ${hit.item.unit}`
                        : hit.reason === 'saved'
                          ? `Saved meal · ${hit.item.unit}`
                          : `${portionLabel(hit.item)}${hit.timesLogged > 1 ? ` · logged ${hit.timesLogged}×` : ''}`
                    }
                    calorieLabel={`${Math.round(hit.item.calories)} kcal`}
                    onClick={() => selectRecentItem(hit.item)}
                    onQuickAdd={() => quickAddItem(hit.item, `history-${hit.item.name}`)}
                    added={justAdded.has(`history-${hit.item.name}`)}
                  />
                ))}
              </div>
            </div>
          )}

          {trimmed && results.common.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-300">Common foods</h3>
              <div className="space-y-2">
                {results.common.slice(0, 6).map((food) => (
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

          {trimmed && results.usdaGeneric.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-300">Generic foods (USDA)</h3>
              <div className="space-y-2">
                {results.usdaGeneric.slice(0, 8).map((food) => (
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

          {/* The shared demo key allows about 30 searches an HOUR across everyone
              using it, so this is not a rare edge case. Say plainly what fixes it. */}
          {trimmed && results.usdaRateLimited && results.usdaGeneric.length === 0 && (
            <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-300/90">
              Generic-food search is out of quota — the shared key allows only ~30 searches an hour
              for all users. A free personal key from USDA raises that to 1,000/hour; add one in
              Settings → Food data.
            </p>
          )}

          {trimmed &&
            (results.loading || results.error || results.branded.length > 0 || results.common.length > 0) && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-slate-300">Branded</h3>

                {results.loading &&
                  (results.common.length > 0 || results.branded.length > 0 ? (
                    <p className="text-sm text-slate-500">Searching online database…</p>
                  ) : (
                    <div className="flex justify-center py-8">
                      <Loader2 size={28} className="animate-spin text-primary-400" />
                    </div>
                  ))}

                {!results.loading &&
                  results.error &&
                  results.branded.length === 0 &&
                  (results.common.length > 0 || results.usdaGeneric.length > 0 || results.history.length > 0 ? (
                    <p className="text-sm text-slate-500">
                      Branded database unavailable — showing what we have.{' '}
                      <button type="button" onClick={results.retry} className="text-emerald-400 underline">
                        Retry
                      </button>
                    </p>
                  ) : (
                    <div className="space-y-3">
                      <EmptyState icon={Search} title="Search failed" subtitle={results.error} />
                      <Button variant="ghost" full onClick={results.retry}>
                        Retry
                      </Button>
                    </div>
                  ))}

                {!results.loading &&
                  !results.error &&
                  results.branded.length === 0 &&
                  (results.common.length > 0 || results.usdaGeneric.length > 0 || results.history.length > 0) && (
                    <p className="text-sm text-slate-500">No branded results for "{trimmed}"</p>
                  )}

                {results.branded.length > 0 && (
                  <div className="space-y-2">
                    {results.branded.map((food) => {
                      const macros = food.perServing ?? food.per100g
                      return (
                        <SearchResultRow
                          key={food.id}
                          name={food.name}
                          brand={food.brand}
                          subtitle={food.servingText}
                          calorieLabel={`${Math.round(macros.calories)} kcal${food.perServing ? '' : ' /100g'}`}
                          onClick={() => selectSearchFood(food)}
                          onQuickAdd={() => quickAddSearchFood(food, food.id)}
                          added={justAdded.has(food.id)}
                        />
                      )
                    })}
                  </div>
                )}
              </div>
            )}

          {trimmed && results.noResults && !results.error && (
            <EmptyState icon={Search} title="No foods found" subtitle={`No results for "${trimmed}"`} />
          )}

          {/* The AI offer for anything that did not read like a meal — underneath
              the rows, but always there. A dead end is the worst place to leave
              someone mid-meal, and the old screen only offered this once search
              had already failed. */}
          {trimmed && !showAiFirst && aiCard}
        </>
      )}

      {/* The tail: still reachable, no longer competing with the box. */}
      {describeText === null && !trimmed && (
        <div className="flex gap-4 pt-1">
          <button
            type="button"
            onClick={onQuickAdd}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-400 active:text-slate-200"
          >
            <Zap size={14} /> Quick add calories
          </button>
          <button
            type="button"
            onClick={onManual}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-400 active:text-slate-200"
          >
            <PencilLine size={14} /> Create a food
          </button>
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

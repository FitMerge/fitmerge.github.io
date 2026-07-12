import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, ScanBarcode, Search } from 'lucide-react'
import Button from '../../components/Button'
import EmptyState from '../../components/EmptyState'
import BarcodeScanSheet from './BarcodeScanSheet'
import FoodDetailPanel from './FoodDetailPanel'
import SearchResultRow from './SearchResultRow'
import { searchFoods } from '../../services/foodSearch/openFoodFacts'
import type { SearchFood } from '../../services/foodSearch/openFoodFacts'
import { searchCommonFoods, loadCommonFoods, commonFoodsReady } from '../../services/foodSearch/commonFoods'
import { useNutritionStore } from '../../store/nutrition'
import type { CustomFood, Macros, MealType } from '../../types'

const DEBOUNCE_MS = 400

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
  defaultMealType?: MealType
  onClose: () => void
}

export default function AddSearchTab({ date, defaultMealType, onClose }: AddSearchTabProps) {
  const customFoods = useNutritionStore((s) => s.customFoods)

  const [query, setQuery] = useState('')
  const [brandedResults, setBrandedResults] = useState<SearchFood[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [retryCount, setRetryCount] = useState(0)
  const [selected, setSelected] = useState<SelectedFood | null>(null)
  const [scanning, setScanning] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const [foodsReady, setFoodsReady] = useState(commonFoodsReady())

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Pull the common-foods database (dynamic chunk) as soon as search opens.
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
      setError('')
      setLoading(false)
      return
    }

    const controller = new AbortController()
    setLoading(true)
    setError('')

    const timer = setTimeout(() => {
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
  }, [query, retryCount])

  // Local, synchronous, always available — this is what surfaces "Egg, whole,
  // cooked" ahead of any packaged/branded OpenFoodFacts noise.
  const commonResults = useMemo(() => searchCommonFoods(query), [query, foodsReady])

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
        defaultMealType={defaultMealType}
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
            placeholder="Search foods…"
            className="w-full bg-slate-800 rounded-lg pl-9 pr-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <button
          type="button"
          onClick={() => setScanning(true)}
          aria-label="Scan barcode"
          className="shrink-0 rounded-lg bg-slate-800 px-3 text-slate-300 active:bg-slate-700"
        >
          <ScanBarcode size={18} />
        </button>
      </div>

      {!trimmedQuery && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-300">My foods</h3>
          {customFoods.length === 0 ? (
            <p className="text-sm text-slate-500">Foods you save will show up here.</p>
          ) : (
            <div className="space-y-2">
              {customFoods.map((food) => (
                <SearchResultRow
                  key={food.id}
                  name={food.name}
                  brand={food.brand}
                  subtitle={food.serving}
                  calorieLabel={`${Math.round(food.per.calories)} kcal /serving`}
                  onClick={() => selectCustomFood(food)}
                />
              ))}
            </div>
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
              />
            ))}
          </div>
        </div>
      )}

      {trimmedQuery && (loading || error || brandedResults.length > 0 || commonResults.length > 0) && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-300">Branded (OpenFoodFacts)</h3>

          {loading &&
            (commonResults.length > 0 ? (
              <p className="text-sm text-slate-500">Searching online database…</p>
            ) : (
              <div className="flex justify-center py-8">
                <Loader2 size={28} className="animate-spin text-primary-400" />
              </div>
            ))}

          {/* When common foods already cover the query, a flaky/slow online
              database shouldn't shout "failed" — keep it a quiet, retryable note. */}
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
                />
              ))}
            </div>
          )}
        </div>
      )}

      {trimmedQuery && !loading && !error && commonResults.length === 0 && brandedResults.length === 0 && (
        <EmptyState icon={Search} title="No foods found" subtitle={`No results for "${trimmedQuery}"`} />
      )}
    </div>
  )
}

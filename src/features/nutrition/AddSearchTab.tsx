import { useEffect, useRef, useState } from 'react'
import { Loader2, Search } from 'lucide-react'
import Button from '../../components/Button'
import EmptyState from '../../components/EmptyState'
import FoodDetailPanel from './FoodDetailPanel'
import SearchResultRow from './SearchResultRow'
import { searchFoods } from '../../services/foodSearch/openFoodFacts'
import type { SearchFood } from '../../services/foodSearch/openFoodFacts'
import { useNutritionStore } from '../../store/nutrition'
import type { CustomFood, Macros, MealType } from '../../types'

const DEBOUNCE_MS = 400

type SelectedFood = {
  name: string
  brand?: string
  servingText: string
  per100g?: Macros
  perServing?: Macros
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
  const [results, setResults] = useState<SearchFood[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [retryCount, setRetryCount] = useState(0)
  const [selected, setSelected] = useState<SelectedFood | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const trimmed = query.trim()
    if (!trimmed) {
      setResults([])
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
          setResults(foods)
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

  function selectSearchFood(food: SearchFood) {
    setSelected({
      name: food.name,
      brand: food.brand,
      servingText: food.servingText,
      per100g: food.per100g,
      perServing: food.perServing,
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
        date={date}
        defaultMealType={defaultMealType}
        allowSaveToMyFoods={!selected.isCustom}
        onClose={onClose}
        onBack={() => setSelected(null)}
      />
    )
  }

  const trimmedQuery = query.trim()

  return (
    <div className="space-y-4">
      <div className="relative">
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

      {trimmedQuery && loading && (
        <div className="flex justify-center py-8">
          <Loader2 size={28} className="animate-spin text-primary-400" />
        </div>
      )}

      {trimmedQuery && !loading && error && (
        <div className="space-y-3">
          <EmptyState icon={Search} title="Search failed" subtitle={error} />
          <Button variant="ghost" full onClick={() => setRetryCount((n) => n + 1)}>
            Retry
          </Button>
        </div>
      )}

      {trimmedQuery && !loading && !error && results.length === 0 && (
        <EmptyState icon={Search} title="No foods found" subtitle={`No results for "${trimmedQuery}"`} />
      )}

      {trimmedQuery && !loading && !error && results.length > 0 && (
        <div className="space-y-2">
          {results.map((food) => (
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
  )
}

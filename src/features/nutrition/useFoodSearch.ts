// Everything the one box needs to know, from every source at once.
//
// Four places can answer "what is this food": your own log, a bundled common-foods
// list, USDA, and OpenFoodFacts. Two of them are someone else's server and both
// fail regularly. Pulling the fan-out in here keeps that mess out of the screen,
// which is then free to be about layout and choice rather than about which
// promise settled first.

import { useEffect, useMemo, useState } from 'react'
import { commonFoodsReady, loadCommonFoods, searchCommonFoods } from '../../services/foodSearch/commonFoods'
import { searchFoods, type SearchFood } from '../../services/foodSearch/openFoodFacts'
import { searchHistory, type HistoryMatch } from '../../services/foodSearch/history'
import { searchUsdaFoods, UsdaRateLimitError } from '../../services/foodSearch/usda'
import { useNutritionStore } from '../../store/nutrition'
import { useSettingsStore } from '../../store/settings'

const DEBOUNCE_MS = 400

export type FoodSearchState = {
  /** Foods you have logged before. Never fails, so it is always offered first. */
  history: HistoryMatch[]
  common: SearchFood[]
  usdaGeneric: SearchFood[]
  branded: SearchFood[]
  loading: boolean
  /** Set when the branded database itself errored, not when it simply matched nothing. */
  error: string
  usdaRateLimited: boolean
  retry: () => void
  /** Nothing anywhere matched, and nothing is still in flight. */
  noResults: boolean
}

export function useFoodSearch(query: string): FoodSearchState {
  const entries = useNutritionStore((s) => s.entries)
  const savedMeals = useNutritionStore((s) => s.savedMeals)
  const customFoods = useNutritionStore((s) => s.customFoods)
  const usdaApiKey = useSettingsStore((s) => s.usdaApiKey)

  const [brandedResults, setBrandedResults] = useState<SearchFood[]>([])
  const [usdaResults, setUsdaResults] = useState<SearchFood[]>([])
  const [usdaRateLimited, setUsdaRateLimited] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [retryCount, setRetryCount] = useState(0)
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

  const trimmed = query.trim()

  useEffect(() => {
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
  }, [trimmed, retryCount, usdaApiKey])

  const common = useMemo(() => searchCommonFoods(query), [query, foodsReady])

  const history = useMemo(
    () => searchHistory(query, { entries, savedMeals, customFoods }),
    [query, entries, savedMeals, customFoods],
  )

  // USDA returns generic and branded together; the branded half belongs with
  // OpenFoodFacts, deduped, because they overlap heavily on packaged food.
  const usdaGeneric = useMemo(() => usdaResults.filter((f) => !f.brand), [usdaResults])
  const branded = useMemo(() => {
    const seen = new Set<string>()
    const out: SearchFood[] = []
    for (const f of [...usdaResults.filter((f) => f.brand), ...brandedResults]) {
      const key = `${f.name.toLowerCase()}::${(f.brand ?? '').toLowerCase()}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push(f)
    }
    return out
  }, [usdaResults, brandedResults])

  return {
    history,
    common,
    usdaGeneric,
    branded,
    loading,
    error,
    usdaRateLimited,
    retry: () => setRetryCount((n) => n + 1),
    noResults:
      trimmed !== '' &&
      !loading &&
      history.length === 0 &&
      common.length === 0 &&
      usdaGeneric.length === 0 &&
      branded.length === 0,
  }
}

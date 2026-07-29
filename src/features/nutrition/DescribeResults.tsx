// The AI breakdown, rendered underneath the box you typed into.
//
// This used to be its own screen with its own textarea, sitting six pixels below
// the search box on the previous screen — two inputs for one sentence, and you
// had to pick which one before you had typed a word. Now the box is the only
// input and this is one of the things that can come back from it, alongside the
// database rows.
//
// So there is no text field here. The sentence stays up in the box where you left
// it; edit it there and this offers to run again.

import { useEffect, useRef, useState } from 'react'
import { ChevronRight, Loader2, RefreshCw, Repeat2 } from 'lucide-react'
import Button from '../../components/Button'
import RefineFoodItemSheet, { type RefinedItem } from './RefineFoodItemSheet'
import { parseFoodDescription, VisionError, type FoodAnalysisItem } from '../../services/foodParse'
import { useNutritionStore } from '../../store/nutrition'
import { useSettingsStore } from '../../store/settings'
import type { MealType } from '../../types'

type Stage = 'parsing' | 'review' | 'error'

type ReviewItem = FoodAnalysisItem & { id: string; included: boolean }

type Props = {
  /** The sentence being broken down — frozen when you asked, not live. */
  text: string
  /** What the box holds right now, so edits can be offered as a re-run. */
  currentText: string
  date: string
  mealType: MealType
  onClose: () => void
  onRedo: (text: string) => void
}

export default function DescribeResults({
  text,
  currentText,
  date,
  mealType,
  onClose,
  onRedo,
}: Props) {
  const addEntry = useNutritionStore((s) => s.addEntry)
  const geminiApiKey = useSettingsStore((s) => s.geminiApiKey)

  const [stage, setStage] = useState<Stage>('parsing')
  const [items, setItems] = useState<ReviewItem[]>([])
  const [message, setMessage] = useState('')
  // A sheet rather than an inline expander: correcting a portion or swapping the
  // food needs room, and an accordion put that work in a 40px slot between rows.
  const [refiningId, setRefiningId] = useState<string | null>(null)

  const ran = useRef(false)
  useEffect(() => {
    if (ran.current) return
    ran.current = true
    void run()
    // Runs once for the text this was mounted with; the hub remounts on re-ask.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // `refresh` is the explicit "ask again" path. An identical description normally
  // returns the identical breakdown from cache — that consistency is the point —
  // but pressing redo is a request for a second opinion.
  async function run(refresh = false) {
    setStage('parsing')
    setRefiningId(null)
    try {
      const result = await parseFoodDescription(text, geminiApiKey, { refresh })
      setItems(result.items.map((it, i) => ({ ...it, id: `${i}-${it.name}`, included: true })))
      setStage('review')
    } catch (err) {
      setMessage(err instanceof VisionError ? err.message : 'Something went wrong — try again.')
      setStage('error')
    }
  }

  function patch(id: string, next: Partial<ReviewItem>) {
    setItems((list) => list.map((i) => (i.id === id ? { ...i, ...next } : i)))
  }

  const included = items.filter((i) => i.included)
  const totals = included.reduce(
    (a, i) => ({
      calories: a.calories + i.calories,
      protein: a.protein + i.protein,
      carbs: a.carbs + i.carbs,
      fat: a.fat + i.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  )

  function save() {
    for (const item of included) {
      addEntry({
        date,
        mealType,
        name: item.name.trim() || 'Food item',
        qty: 1,
        unit: item.servingText || 'serving',
        calories: item.calories,
        protein: item.protein,
        carbs: item.carbs,
        fat: item.fat,
        source: 'describe',
      })
    }
    onClose()
  }

  const edited = currentText.trim() !== text.trim() && currentText.trim().length > 0

  if (stage === 'parsing') {
    return (
      <div className="flex flex-col items-center gap-2 py-10">
        <Loader2 size={28} className="animate-spin text-primary-400" />
        <p className="text-sm text-slate-400">Working out “{text}”…</p>
      </div>
    )
  }

  if (stage === 'error') {
    return (
      <div className="space-y-3 rounded-xl bg-slate-900 p-4">
        <p className="text-sm text-amber-300">{message}</p>
        <Button variant="ghost" full onClick={() => void run()}>
          Try again
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Editing the box is how you add detail ("the rice was 2 cups"). Offering
          the re-run only once it actually differs keeps a dead button off screen. */}
      {edited && (
        <Button variant="ghost" full onClick={() => onRedo(currentText)}>
          <span className="flex items-center justify-center gap-1.5">
            <RefreshCw size={14} /> Redo with your edits
          </span>
        </Button>
      )}

      <div className="flex items-baseline justify-between">
        <p className="text-sm font-semibold text-slate-100">
          {items.length} item{items.length === 1 ? '' : 's'}
        </p>
        <p className="text-xs text-slate-400">Tap to fix portion or swap</p>
      </div>

      {items.map((item) => {
        const alts = item.alternatives?.length ?? 0
        return (
          <div
            key={item.id}
            className={`flex items-center gap-2 rounded-xl border p-3 ${
              item.included ? 'border-slate-700 bg-slate-800/60' : 'border-slate-800 bg-slate-900/60 opacity-50'
            }`}
          >
            <input
              type="checkbox"
              checked={item.included}
              onChange={(e) => patch(item.id, { included: e.target.checked })}
              onClick={(e) => e.stopPropagation()}
              aria-label={`Include ${item.name}`}
              className="h-4 w-4 shrink-0 rounded accent-primary-500"
            />
            <button
              type="button"
              onClick={() => setRefiningId(item.id)}
              className="flex min-w-0 flex-1 items-center gap-2 text-left"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-slate-100">{item.name}</span>
                <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
                  <span className="truncate">
                    {item.servingText} · {Math.round(item.protein)}P {Math.round(item.carbs)}C{' '}
                    {Math.round(item.fat)}F
                  </span>
                  {/* Advertise the swaps: an affordance nobody knows about is the
                      same as one that does not exist. */}
                  {alts > 0 && (
                    <span className="flex shrink-0 items-center gap-0.5 text-slate-600">
                      <Repeat2 size={10} />
                      {alts}
                    </span>
                  )}
                </span>
              </span>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-200">
                {Math.round(item.calories)}
              </span>
              <ChevronRight size={15} className="shrink-0 text-slate-500" />
            </button>
          </div>
        )
      })}

      <div className="rounded-xl bg-slate-800/60 p-3 text-center">
        <p className="text-lg font-bold text-slate-100">{Math.round(totals.calories)} kcal</p>
        <p className="text-xs text-slate-400">
          {Math.round(totals.protein)}P · {Math.round(totals.carbs)}C · {Math.round(totals.fat)}F
        </p>
      </div>

      <Button variant="primary" full onClick={save} disabled={included.length === 0}>
        Add {included.length} to diary
      </Button>

      <p className="text-[11px] text-slate-500">
        These are estimates. Correct anything that looks off before adding — what you save is what
        gets logged.
      </p>

      <RefineFoodItemSheet
        item={items.find((i) => i.id === refiningId) ?? null}
        onClose={() => setRefiningId(null)}
        onApply={(next: RefinedItem) => refiningId && patch(refiningId, next)}
      />
    </div>
  )
}

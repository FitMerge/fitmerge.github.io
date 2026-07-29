import { useEffect, useRef, useState } from 'react'
import { ChevronRight, Loader2, RefreshCw, Repeat2, Sparkles, Wand2 } from 'lucide-react'
import Button from '../../components/Button'
import RefineFoodItemSheet, { type RefinedItem } from './RefineFoodItemSheet'
import { parseFoodDescription, VisionError, type FoodAnalysisItem } from '../../services/foodParse'
import { useNutritionStore } from '../../store/nutrition'
import { useSettingsStore } from '../../store/settings'
import type { MealType } from '../../types'

type Stage = 'input' | 'parsing' | 'review' | 'error'

type ReviewItem = FoodAnalysisItem & { id: string; included: boolean }

type AddDescribeTabProps = {
  date: string
  mealType: MealType
  onClose: () => void
  /** Carried over from the search box — breaking it down starts immediately, so
   * arriving here never means retyping what was already typed. */
  initialText?: string
}

const EXAMPLES = [
  'chicken burrito bowl with rice, black beans and guac',
  'two scrambled eggs, toast with butter, black coffee',
  '8oz sirloin, baked potato, side salad',
]

/**
 * Log a meal by describing it. The search path needs one lookup per component
 * with a serving size each — fine for a labelled packet, miserable for a plate of
 * real food — which is why people give up and estimate elsewhere. Here the whole
 * meal goes in as one sentence and comes back as reviewable, editable items.
 */
export default function AddDescribeTab({ date, mealType, onClose, initialText }: AddDescribeTabProps) {
  const addEntry = useNutritionStore((s) => s.addEntry)
  const geminiApiKey = useSettingsStore((s) => s.geminiApiKey)

  const [text, setText] = useState(initialText ?? '')
  const [stage, setStage] = useState<Stage>('input')
  const [items, setItems] = useState<ReviewItem[]>([])
  const [message, setMessage] = useState('')
  // The item being adjusted, if any. A sheet rather than an inline expander:
  // correcting a portion or swapping the food needs room, and an accordion put
  // that work in a 40px slot between two other rows.
  const [refiningId, setRefiningId] = useState<string | null>(null)

  // Coming from search, the intent is already stated — break it down without
  // making the user press the button again. Guarded so a re-render can't re-ask.
  const autoRan = useRef(false)
  useEffect(() => {
    if (autoRan.current || !initialText?.trim()) return
    autoRan.current = true
    void run()
    // Runs once for the seed it arrived with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialText])

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

  // `refresh` is the explicit "ask again" path. Normally an identical
  // description returns the identical breakdown from cache — that consistency is
  // the point — but pressing redo is a request for a second opinion, so it must
  // not silently hand back the answer you just rejected.
  async function run(refresh = false) {
    if (!text.trim()) return
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

  if (stage === 'review') {
    return (
      <div className="space-y-3">
        {/* What was understood, still editable. When an item comes back wrong the
            fix is usually more context ("the rice was 2 cups"), not retyping the
            macros — so the sentence stays in reach instead of being left behind. */}
        <div className="space-y-2 rounded-xl bg-slate-800/60 p-3">
          <label className="text-[11px] font-medium uppercase tracking-wide text-slate-500">You ate</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            className="w-full resize-none rounded-lg bg-slate-900 px-2.5 py-2 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-primary-500"
          />
          <Button variant="ghost" full onClick={() => void run(true)} disabled={!text.trim()}>
            <span className="flex items-center justify-center gap-1.5">
              <RefreshCw size={14} /> Add detail &amp; redo
            </span>
          </Button>
        </div>

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
                    {/* Advertise the swaps: an affordance nobody knows about is
                        the same as one that does not exist. */}
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

        {/* Redoing lives up top with the description now, so the only choice left
            here is to commit. */}
        <Button variant="primary" full onClick={save} disabled={included.length === 0}>
          Add {included.length} to diary
        </Button>

        <p className="text-[11px] text-slate-500">
          These are estimates. Correct anything that looks off before adding — what you save is what gets logged.
        </p>

        <RefineFoodItemSheet
          item={items.find((i) => i.id === refiningId) ?? null}
          onClose={() => setRefiningId(null)}
          onApply={(next: RefinedItem) => refiningId && patch(refiningId, next)}
        />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Wand2 size={16} className="text-primary-400" />
        <p className="text-sm font-semibold text-slate-100">Describe what you ate</p>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="e.g. chicken burrito bowl with rice, black beans and guac"
        className="w-full resize-none rounded-xl bg-slate-800 px-3 py-2.5 text-base text-slate-100 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-primary-500"
      />

      {stage === 'error' && <p className="text-sm text-amber-300">{message}</p>}

      <Button variant="primary" full onClick={() => void run()} disabled={!text.trim() || stage === 'parsing'}>
        <span className="flex items-center justify-center gap-1.5">
          {stage === 'parsing' ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {stage === 'parsing' ? 'Working it out…' : 'Break it down'}
        </span>
      </Button>

      {stage !== 'parsing' && (
        <div className="space-y-1.5">
          <p className="text-[11px] text-slate-500">Try something like:</p>
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setText(ex)}
              className="block w-full rounded-lg bg-slate-800/60 px-3 py-2 text-left text-xs text-slate-400 active:bg-slate-800"
            >
              {ex}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

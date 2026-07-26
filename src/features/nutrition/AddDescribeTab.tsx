import { useEffect, useRef, useState } from 'react'
import { Loader2, Sparkles, Wand2 } from 'lucide-react'
import Button from '../../components/Button'
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

function confidenceClasses(c: number): string {
  if (c >= 0.75) return 'bg-emerald-500/15 text-emerald-400'
  if (c >= 0.5) return 'bg-amber-500/15 text-amber-400'
  return 'bg-red-500/15 text-red-400'
}

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

  async function run() {
    if (!text.trim()) return
    setStage('parsing')
    try {
      const result = await parseFoodDescription(text, geminiApiKey)
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
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-semibold text-slate-100">
            {items.length} item{items.length === 1 ? '' : 's'} found
          </p>
          <p className="text-xs text-slate-400">Tap any number to correct it</p>
        </div>

        {items.map((item) => (
          <div
            key={item.id}
            className={`space-y-2 rounded-xl border p-3 ${
              item.included ? 'border-slate-700 bg-slate-800/60' : 'border-slate-800 bg-slate-900/60 opacity-50'
            }`}
          >
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={item.included}
                onChange={(e) => patch(item.id, { included: e.target.checked })}
                className="mt-1 h-4 w-4 shrink-0 rounded accent-primary-500"
              />
              <div className="min-w-0 flex-1">
                <input
                  value={item.name}
                  onChange={(e) => patch(item.id, { name: e.target.value })}
                  className="w-full bg-transparent text-sm font-medium text-slate-100 outline-none"
                />
                <p className="text-[11px] text-slate-500">{item.servingText}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] ${confidenceClasses(item.confidence)}`}>
                {Math.round(item.confidence * 100)}%
              </span>
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              {(
                [
                  ['calories', 'kcal'],
                  ['protein', 'P'],
                  ['carbs', 'C'],
                  ['fat', 'F'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="rounded-lg bg-slate-900 px-2 py-1 text-center">
                  <span className="block text-[10px] uppercase tracking-wide text-slate-500">{label}</span>
                  <input
                    value={item[key]}
                    onChange={(e) => patch(item.id, { [key]: Math.max(0, Number(e.target.value) || 0) })}
                    inputMode="numeric"
                    className="w-full bg-transparent text-center text-sm tabular-nums text-slate-100 outline-none"
                  />
                </label>
              ))}
            </div>
          </div>
        ))}

        <div className="rounded-xl bg-slate-800/60 p-3 text-center">
          <p className="text-lg font-bold text-slate-100">{Math.round(totals.calories)} kcal</p>
          <p className="text-xs text-slate-400">
            {Math.round(totals.protein)}P · {Math.round(totals.carbs)}C · {Math.round(totals.fat)}F
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="ghost" full onClick={() => setStage('input')}>
            Redo
          </Button>
          <Button variant="primary" full onClick={save} disabled={included.length === 0}>
            Add {included.length} to diary
          </Button>
        </div>

        <p className="text-[11px] text-slate-500">
          These are estimates. Correct anything that looks off before adding — what you save is what gets logged.
        </p>
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

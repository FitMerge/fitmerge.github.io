// Pick which of YOUR daily habits count toward a challenge, and what each is
// worth.
//
// Weights are percentages of the day, which is what keeps the board fair when
// everyone brings a different list: three habits or eight, a perfect day is
// worth the same to everyone. The editor's whole job is getting to exactly 100.

import { Check, Zap } from 'lucide-react'
import { useSupplementStore } from '../../store/supplements'
import { goalRuleFor } from '../assistant/goalAutoCheck'
import { DAY_POINTS } from './scoring'
import { balance, isBalanced, remainingWeight, setWeight, toggleHabit, type WeightMap } from './weights'

type Props = {
  weights: WeightMap
  onChange: (weights: WeightMap) => void
}

export default function HabitWeightEditor({ weights, onChange }: Props) {
  const items = useSupplementStore((s) => s.items)
  const selected = Object.keys(weights)
  const left = remainingWeight(weights)
  const balanced = isBalanced(weights)

  if (items.length === 0) {
    return (
      <p className="rounded-xl bg-slate-800/60 p-3 text-xs leading-relaxed text-slate-400">
        You have no daily habits yet. Add a few to your daily checklist first — those are what a challenge
        scores.
      </p>
    )
  }

  return (
    <div className="space-y-2.5">
      <p className="text-xs text-slate-400">
        Pick the habits that count and set what each is worth. They add up to {DAY_POINTS}% of your day.
      </p>

      <div className="space-y-1.5">
        {items.map((item) => {
          const on = item.id in weights
          const auto = item.link != null || goalRuleFor(item.name) !== null
          return (
            <div key={item.id} className={`rounded-xl ${on ? 'bg-slate-900' : 'bg-slate-900/40'}`}>
              <div className="flex items-center gap-2.5 p-2.5">
                <button
                  type="button"
                  onClick={() => onChange(toggleHabit(weights, item.id))}
                  aria-label={on ? `Remove ${item.name}` : `Include ${item.name}`}
                  aria-pressed={on}
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${
                    on ? 'border-primary-500 bg-primary-500 text-slate-950' : 'border-slate-600 text-transparent'
                  }`}
                >
                  <Check size={14} strokeWidth={3} />
                </button>

                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-sm ${on ? 'text-slate-100' : 'text-slate-500'}`}>
                    {item.name}
                  </span>
                  {auto && (
                    <span className="flex items-center gap-1 text-[10px] text-sky-400">
                      <Zap size={9} /> auto-tracked
                    </span>
                  )}
                </span>

                {on && (
                  <span className="flex shrink-0 items-center gap-1">
                    {/* Text input rather than a number spinner: a percentage is a
                        two-digit edit and the spinner arrows are a nuisance on a phone. */}
                    <input
                      value={String(weights[item.id] ?? 0)}
                      onChange={(e) => {
                        const n = parseInt(e.target.value.replace(/\D/g, ''), 10)
                        onChange(setWeight(weights, item.id, Number.isFinite(n) ? n : 0))
                      }}
                      inputMode="numeric"
                      aria-label={`${item.name} weight, percent`}
                      className="w-14 rounded-lg bg-slate-800 px-2 py-1.5 text-center text-base tabular-nums text-slate-100 outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <span className="text-xs text-slate-500">%</span>
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div
        className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs ${
          balanced ? 'bg-primary-500/15 text-primary-300' : 'bg-amber-500/15 text-amber-300'
        }`}
      >
        <span className="font-medium tabular-nums">
          {selected.length === 0
            ? 'Pick at least one habit'
            : balanced
              ? `Balanced at ${DAY_POINTS}%`
              : left > 0
                ? `${left}% left to assign`
                : `${-left}% over`}
        </span>
        {!balanced && selected.length > 0 && (
          <button
            type="button"
            onClick={() => onChange(balance(weights))}
            className="font-semibold text-slate-100 underline underline-offset-2"
          >
            Balance
          </button>
        )}
      </div>
    </div>
  )
}

import { useState } from 'react'
import { Check, Flame, Plus, Trash2 } from 'lucide-react'
import { doseFor, fullCompletionStreak, useSupplementStore } from '../../store/supplements'
import { todayISO } from '../../lib/date'

/** The 75 Hard checklist, one tap to install. Water/diet/workouts are still
 * tracked in their own parts of the app — these are the daily check-offs. */
const SEVENTY_FIVE_HARD: { name: string; unit?: string; targetAmount?: number }[] = [
  { name: 'Workout 1 — 45 min' },
  { name: 'Workout 2 — 45 min outdoors' },
  { name: 'Drink 1 gallon of water' },
  { name: 'Read 10 pages (nonfiction)' },
  { name: 'Follow the diet — zero cheats, zero alcohol' },
  { name: 'Progress photo' },
]

/** Today's daily-goals checklist (supplements, habits, challenge tasks) with a
 * challenge day counter, inline add, and a one-tap 75 Hard preset. Used in the
 * Action Hub and (compact) on the dashboard. */
export default function SupplementList({ date = todayISO(), compact = false }: { date?: string; compact?: boolean }) {
  const items = useSupplementStore((s) => s.items)
  const log = useSupplementStore((s) => s.log)
  const toggle = useSupplementStore((s) => s.toggle)
  const addItem = useSupplementStore((s) => s.addItem)
  const removeItem = useSupplementStore((s) => s.removeItem)

  const doneCount = items.filter((i) => doseFor(log, date, i.id) > 0).length
  const streak = fullCompletionStreak(items, log, date)
  // "Day N": completed streak, counting today as in-progress until it's finished.
  const dayNumber = doneCount === items.length && items.length > 0 ? streak : streak + 1
  const has75Hard = items.some((i) => i.name.startsWith('Workout 1'))

  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [unit, setUnit] = useState('')
  const [adding, setAdding] = useState(false)

  function add() {
    const n = name.trim()
    if (!n) return
    const amt = parseFloat(amount)
    addItem({ name: n, targetAmount: Number.isFinite(amt) ? amt : undefined, unit: unit.trim() || undefined })
    setName('')
    setAmount('')
    setUnit('')
    setAdding(false)
  }

  return (
    <div className="space-y-2">
      {items.length === 0 && !adding && (
        <p className="text-xs text-slate-500">
          No daily goals yet. Add creatine, vitamins, protein targets — or install the 75 Hard checklist below.
        </p>
      )}

      {items.length > 0 && (
        <div className="flex items-center justify-between rounded-lg bg-slate-800/50 px-3 py-2">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-orange-400">
            <Flame size={14} />
            Day {dayNumber}
            {doneCount < items.length && <span className="font-normal text-slate-500">in progress</span>}
          </span>
          <span className="text-xs text-slate-400">
            {doneCount}/{items.length} done today
          </span>
        </div>
      )}

      {items.map((s) => {
        const done = doseFor(log, date, s.id) > 0
        const dose = s.targetAmount ? `${s.targetAmount}${s.unit ?? ''}` : null
        return (
          <div key={s.id} className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => toggle(date, s.id)}
              className={`flex h-9 flex-1 items-center gap-2.5 rounded-lg px-3 text-left ${
                done ? 'bg-primary-500/15' : 'bg-slate-800'
              }`}
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                  done ? 'bg-primary-500 text-slate-950' : 'border border-slate-600'
                }`}
              >
                {done && <Check size={13} />}
              </span>
              <span className={`flex-1 truncate text-sm ${done ? 'text-slate-100' : 'text-slate-300'}`}>{s.name}</span>
              {dose && <span className="shrink-0 text-[11px] text-slate-500">{dose}</span>}
            </button>
            {!compact && (
              <button
                type="button"
                onClick={() => removeItem(s.id)}
                aria-label={`Remove ${s.name}`}
                className="shrink-0 p-1.5 text-slate-600 active:text-rose-400"
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
        )
      })}

      {!compact &&
        (adding ? (
          <div className="space-y-2 rounded-lg bg-slate-800/60 p-2.5">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name (e.g. Creatine)"
              autoFocus
              className="w-full rounded-lg bg-slate-800 px-3 py-2 text-base text-slate-100 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-primary-500"
            />
            <div className="flex gap-2">
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                placeholder="Amount"
                className="w-24 rounded-lg bg-slate-800 px-3 py-2 text-base text-slate-100 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-primary-500"
              />
              <input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="Unit (g)"
                className="w-20 rounded-lg bg-slate-800 px-3 py-2 text-base text-slate-100 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-primary-500"
              />
              <button type="button" onClick={add} className="flex-1 rounded-lg bg-primary-500 text-sm font-semibold text-slate-950">
                Add
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex items-center gap-1.5 text-xs font-medium text-primary-400"
            >
              <Plus size={14} /> Add goal or supplement
            </button>
            {!has75Hard && (
              <button
                type="button"
                onClick={() => {
                  for (const t of SEVENTY_FIVE_HARD) {
                    if (!items.some((i) => i.name === t.name)) addItem(t)
                  }
                }}
                className="flex items-center gap-1.5 text-xs font-medium text-orange-400"
              >
                <Flame size={14} /> Add 75 Hard checklist
              </button>
            )}
          </div>
        ))}
    </div>
  )
}

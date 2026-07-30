import { useState } from 'react'
import { Check, Flame, Plus, Trash2, Zap } from 'lucide-react'
import { doseFor, fullCompletionStreak, useSupplementStore, type GoalMetric } from '../../store/supplements'
import { useSettingsStore } from '../../store/settings'
import { GOAL_METRICS, goalRuleFor, suggestMetric } from './goalAutoCheck'
import { todayISO } from '../../lib/date'
import ChallengePanel from '../challenges/ChallengePanel'

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

type PendingLink = {
  /** The goal is created immediately; this is its id, so dismissing the prompt
   * can never lose what the user typed. */
  id: string
  name: string
  metric: GoalMetric
  /** Kept as text while editing so a half-typed "7." isn't parsed away — the same
   * reason NumberField holds a draft string. */
  target: string
}

// Sleep time is stored in minutes but entered in hours; everything else is 1:1.
function targetDisplayUnit(metric: GoalMetric): string {
  return metric === 'sleepMinutes' ? 'h' : (GOAL_METRICS[metric].targetSuffix ?? '')
}
function toStoredTarget(metric: GoalMetric, display: number): number {
  return metric === 'sleepMinutes' ? Math.round(display * 60) : display
}

export default function SupplementList({ date = todayISO(), compact = false }: { date?: string; compact?: boolean }) {
  const items = useSupplementStore((s) => s.items)
  const log = useSupplementStore((s) => s.log)
  const toggle = useSupplementStore((s) => s.toggle)
  const addItem = useSupplementStore((s) => s.addItem)
  const updateItem = useSupplementStore((s) => s.updateItem)
  const removeItem = useSupplementStore((s) => s.removeItem)
  const proteinGoal = useSettingsStore((s) => s.goals.protein)

  const doneCount = items.filter((i) => doseFor(log, date, i.id) > 0).length
  const streak = fullCompletionStreak(items, log, date)
  // "Day N": completed streak, counting today as in-progress until it's finished.
  const dayNumber = doneCount === items.length && items.length > 0 ? streak : streak + 1
  const has75Hard = items.some((i) => i.name.startsWith('Workout 1'))
  const anyAuto = items.some((i) => i.link != null || goalRuleFor(i.name) !== null)

  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [unit, setUnit] = useState('')
  const [adding, setAdding] = useState(false)
  const [pending, setPending] = useState<PendingLink | null>(null)

  // Metric goals worth suggesting — target seeded from settings where relevant.
  const METRIC_PRESETS: { name: string; metric: GoalMetric; target?: number }[] = [
    { name: 'Weigh in', metric: 'weighin' },
    { name: 'Sleep 8h', metric: 'sleepMinutes', target: 480 },
    { name: 'Hit protein', metric: 'protein', target: proteinGoal || 150 },
    { name: '10k steps', metric: 'steps', target: 10000 },
  ]

  function resetForm() {
    setName('')
    setAmount('')
    setUnit('')
    setAdding(false)
    setPending(null)
  }

  function add() {
    const n = name.trim()
    if (!n) return
    const amt = parseFloat(amount)
    // Create the goal up front. The link prompt is then a pure upgrade, so
    // closing the sheet mid-prompt leaves a working manual goal rather than
    // silently discarding what was typed.
    const id = addItem({
      name: n,
      targetAmount: Number.isFinite(amt) ? amt : undefined,
      unit: unit.trim() || undefined,
    })
    const metric = suggestMetric(n)
    if (metric) {
      const def = GOAL_METRICS[metric]
      const display =
        metric === 'sleepMinutes' ? 8 : metric === 'protein' ? proteinGoal || 150 : def.defaultTarget ?? 0
      setName('')
      setAmount('')
      setUnit('')
      setAdding(false)
      setPending({ id, name: n, metric, target: String(display) })
      return
    }
    resetForm()
  }

  /** The typed target, or null when it isn't a usable positive number. A zero or
   * blank target would make the goal complete itself every single day. */
  const pendingTarget = (() => {
    if (!pending) return null
    if (!GOAL_METRICS[pending.metric].needsTarget) return undefined
    const n = parseFloat(pending.target)
    return Number.isFinite(n) && n > 0 ? toStoredTarget(pending.metric, n) : null
  })()

  function confirmLink() {
    if (!pending || pendingTarget === null) return
    updateItem(pending.id, { link: { metric: pending.metric, target: pendingTarget } })
    resetForm()
  }

  function addPreset(p: { name: string; metric: GoalMetric; target?: number }) {
    if (items.some((i) => i.name.toLowerCase() === p.name.toLowerCase())) return
    addItem({ name: p.name, link: { metric: p.metric, target: p.target } })
  }

  return (
    <div className="space-y-2">
      {/* Any live challenge sits directly above the boxes that feed it, so the
          consequence of ticking one is visible without leaving the screen. */}
      <ChallengePanel />

      {items.length === 0 && !adding && !pending && (
        <p className="text-xs text-slate-500">
          No daily goals yet. Add habits, supplements or targets — many tick themselves from your logs.
        </p>
      )}

      {items.length > 0 && (
        <div className="flex items-center justify-between rounded-lg bg-slate-800/50 px-3 py-2">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-orange-400">
            <Flame size={14} />
            Day {dayNumber}
            {doneCount < items.length && <span className="ml-1 font-normal text-slate-500">in progress</span>}
          </span>
          <span className="text-xs text-slate-400">
            {doneCount}/{items.length} done today
          </span>
        </div>
      )}

      {!compact && anyAuto && (
        <p className="flex items-center gap-1 text-[11px] text-slate-500">
          <Zap size={11} className="text-sky-400" /> goals with a bolt tick themselves from your logs &amp; health data
        </p>
      )}

      {items.map((s) => {
        const done = doseFor(log, date, s.id) > 0
        const dose = s.targetAmount ? `${s.targetAmount}${s.unit ?? ''}` : null
        const auto = s.link != null || goalRuleFor(s.name) !== null
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
              {auto && <Zap size={12} className="shrink-0 text-sky-400" aria-label="Auto-checked from your logs" />}
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

      {!compact && pending && (
        <div className="space-y-2.5 rounded-lg border border-sky-500/30 bg-slate-800/60 p-3">
          <p className="flex items-center gap-1.5 text-sm font-medium text-slate-100">
            <Zap size={14} className="text-sky-400" /> Auto-track “{pending.name}”?
          </p>
          <p className="text-xs text-slate-400">
            This can tick itself from {GOAL_METRICS[pending.metric].source} — no tapping needed.
          </p>
          {GOAL_METRICS[pending.metric].needsTarget && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Each day reach</span>
              {/* Held as text: parsing on every keystroke would swallow the "."
                  in "7.5" and turn a cleared field into a target of 0. */}
              <input
                value={pending.target}
                onChange={(e) => setPending({ ...pending, target: e.target.value.replace(/[^\d.]/g, '') })}
                inputMode="decimal"
                className="w-20 rounded-lg bg-slate-800 px-3 py-1.5 text-base text-slate-100 outline-none focus:ring-2 focus:ring-primary-500"
              />
              <span className="text-xs text-slate-500">{targetDisplayUnit(pending.metric)}</span>
            </div>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={confirmLink}
              disabled={pendingTarget === null}
              className="flex-1 rounded-lg bg-primary-500 py-2 text-sm font-semibold text-slate-950 disabled:opacity-40"
            >
              Link it
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="flex-1 rounded-lg bg-slate-800 py-2 text-sm font-medium text-slate-300 active:bg-slate-700"
            >
              Keep manual
            </button>
          </div>
        </div>
      )}

      {!compact &&
        !pending &&
        (adding ? (
          <div className="space-y-2 rounded-lg bg-slate-800/60 p-2.5">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name (e.g. Creatine, Weigh in, Sleep 8h)"
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
          <div className="space-y-2">
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
            <div className="flex flex-wrap gap-1.5">
              {METRIC_PRESETS.filter((p) => !items.some((i) => i.name.toLowerCase() === p.name.toLowerCase())).map(
                (p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => addPreset(p)}
                    className="flex items-center gap-1 rounded-full bg-slate-800 px-2.5 py-1 text-[11px] font-medium text-sky-300 active:bg-slate-700"
                  >
                    <Zap size={11} /> {p.name}
                  </button>
                ),
              )}
            </div>
          </div>
        ))}
    </div>
  )
}

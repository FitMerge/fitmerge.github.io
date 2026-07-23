// "How do I improve these numbers?" — data-aware training guidance for the
// fitness scores Garmin reports (VO₂ max, endurance score) plus overall fitness.
// Each block reads the user's current value and 90-day direction, then gives the
// evidence-backed levers that actually move that metric. Rule-based and instant.

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, Lightbulb, TrendingDown, TrendingUp } from 'lucide-react'
import Card from '../../components/Card'
import { useHealthStore } from '../../store/health'
import { useWorkoutsStore } from '../../store/workouts'
import { addDays, todayISO } from '../../lib/date'
import { metricSamples } from '../progress/healthTrends'

type TipBlock = {
  key: string
  title: string
  value: string | null
  delta: number | null
  deltaLabel: string | null
  read: string
  tips: string[]
}

function latestAndDelta(samples: { date: string; value: number }[]): { latest: number | null; delta: number | null } {
  if (!samples.length) return { latest: null, delta: null }
  const latest = samples[samples.length - 1].value
  const cutoff = addDays(todayISO(), -90)
  const window = samples.filter((s) => s.date >= cutoff)
  const first = window.length >= 2 ? window[0].value : null
  return { latest, delta: first !== null ? latest - first : null }
}

export default function FitnessTipsSection() {
  const days = useHealthStore((s) => s.days)
  const sessions = useWorkoutsStore((s) => s.sessions)
  const [open, setOpen] = useState<string | null>('vo2max')

  const blocks = useMemo<TipBlock[]>(() => {
    const vo2 = latestAndDelta(metricSamples(days, 'vo2max'))
    const endurance = latestAndDelta(metricSamples(days, 'enduranceScore'))

    // Training consistency over the last 28 days, to tailor the advice.
    const cutoff = addDays(todayISO(), -27)
    const recent = sessions.filter((s) => (s.finishedAt || s.imported) && s.date >= cutoff)
    const cardioPerWeek = recent.filter((s) => s.imported || s.entries.length === 0).length / 4
    const strengthPerWeek = recent.filter((s) => !s.imported && s.entries.length > 0).length / 4

    const out: TipBlock[] = []

    out.push({
      key: 'vo2max',
      title: 'VO₂ max',
      value: vo2.latest !== null ? vo2.latest.toFixed(1) : null,
      delta: vo2.delta,
      deltaLabel: vo2.delta !== null ? `${vo2.delta >= 0 ? '+' : ''}${vo2.delta.toFixed(1)} in 90d` : null,
      read:
        vo2.delta !== null && vo2.delta > 0.3
          ? 'Trending up — what you\'re doing is working. The tips below speed it up.'
          : 'VO₂ max responds fastest to short hard intervals layered on an easy aerobic base.',
      tips: [
        'Add 1–2 interval sessions a week: 4 × 4 min hard (can\'t hold a conversation) with 3 min easy between. This is the single biggest VO₂ max lever.',
        cardioPerWeek < 2
          ? `You averaged ${cardioPerWeek.toFixed(1)} cardio sessions/week this month — get to 3+ easy-pace sessions first, then add intervals.`
          : 'Keep ~80% of your cardio genuinely easy (you can talk in full sentences) — the easy base is what lets the hard 20% work.',
        'Losing body fat raises VO₂ max by itself (it\'s scored per kg) — your current cut is already helping.',
      ],
    })

    out.push({
      key: 'endurance',
      title: 'Endurance score',
      value: endurance.latest !== null ? Math.round(endurance.latest).toLocaleString() : null,
      delta: endurance.delta,
      deltaLabel:
        endurance.delta !== null
          ? `${endurance.delta >= 0 ? '+' : ''}${Math.round(endurance.delta).toLocaleString()} in 90d`
          : null,
      read: 'Garmin\'s endurance score rewards long, steady aerobic work accumulated week after week.',
      tips: [
        'Make one session a week your "long one" — 60–90+ min at an easy, steady pace — and stretch it by ~10% every couple of weeks.',
        'Frequency beats heroics: 3–4 aerobic sessions a week, every week, moves this score more than one monster workout.',
        'Fuel long sessions (carbs before/during) — bonking teaches your body nothing except how to be miserable.',
      ],
    })

    out.push({
      key: 'overall',
      title: 'Overall fitness',
      value: null,
      delta: null,
      deltaLabel: null,
      read: `This month you averaged ${strengthPerWeek.toFixed(1)} lifts and ${cardioPerWeek.toFixed(1)} cardio sessions per week.`,
      tips: [
        strengthPerWeek < 2
          ? 'Lift at least 2–3×/week — strength is the foundation everything else sits on.'
          : 'Your lifting frequency is solid — keep adding small amounts of weight or reps (progressive overload is the whole game).',
        'Protect sleep like a training session: 7.5+ h consistently is worth more than any supplement.',
        'Daily movement floor: 8–10k steps on top of workouts keeps calorie burn and recovery circulation up.',
        'Deload every 6–8 weeks (about half your normal volume for a week) — fitness is built during recovery, not during the workout.',
      ],
    })

    return out
  }, [days, sessions])

  return (
    <Card className="space-y-2">
      <div className="flex items-center gap-2">
        <Lightbulb size={16} className="text-amber-400" />
        <h2 className="text-sm font-semibold text-slate-200">Improve your fitness</h2>
      </div>

      {blocks.map((b) => {
        const isOpen = open === b.key
        return (
          <div key={b.key} className="rounded-xl bg-slate-800/50">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : b.key)}
              className="flex w-full items-center justify-between gap-2 p-3 text-left"
            >
              <span className="flex items-baseline gap-2">
                <span className="text-sm font-semibold text-slate-100">{b.title}</span>
                {b.value && <span className="text-sm font-bold text-sky-400">{b.value}</span>}
                {b.deltaLabel && b.delta !== null && (
                  <span
                    className={`flex items-center gap-0.5 text-[11px] ${b.delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
                  >
                    {b.delta >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {b.deltaLabel}
                  </span>
                )}
              </span>
              {isOpen ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
            </button>
            {isOpen && (
              <div className="space-y-2 px-3 pb-3">
                <p className="text-xs text-slate-400">{b.read}</p>
                <ul className="space-y-1.5">
                  {b.tips.map((t, i) => (
                    <li key={i} className="flex gap-2 text-xs leading-relaxed text-slate-300">
                      <span className="mt-0.5 text-amber-400">•</span>
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )
      })}
    </Card>
  )
}

// Cardio, made visible the moment you open Train — instead of buried under
// Progress → Cardio (behind a Lifting-first tab). A runner/rider should see their
// week and their last activity at a glance, with the full dashboard one tap away.

import { useMemo, useState } from 'react'
import { Activity, ChevronRight, Plus } from 'lucide-react'
import Card from '../../components/Card'
import Button from '../../components/Button'
import SessionDetail from './SessionDetail'
import { useWorkoutsStore } from '../../store/workouts'
import { useSettingsStore } from '../../store/settings'
import { addDays, todayISO } from '../../lib/date'
import {
  cardioSummaryLine,
  distanceUnitLabel,
  formatTotalDuration,
  isCardioSession,
  sessionDurationMin,
} from './cardio'
import type { WorkoutSession } from '../../types'

function dayLabel(iso: string): string {
  const today = todayISO()
  if (iso === today) return 'Today'
  if (iso === addDays(today, -1)) return 'Yesterday'
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export default function CardioSummaryCard({
  onSeeAll,
  onLog,
}: {
  /** Jump straight to the full cardio dashboard. */
  onSeeAll: () => void
  /** Open the Log activity sheet (empty-state CTA). */
  onLog: () => void
}) {
  const sessions = useWorkoutsStore((s) => s.sessions)
  const units = useSettingsStore((s) => s.units)
  const distUnit = distanceUnitLabel(units)
  const [openSession, setOpenSession] = useState<WorkoutSession | null>(null)

  const allCardio = useMemo(
    () =>
      sessions
        .filter(isCardioSession)
        .sort((a, b) => (a.date !== b.date ? (a.date < b.date ? 1 : -1) : (b.finishedAt ?? 0) - (a.finishedAt ?? 0))),
    [sessions],
  )

  const week = useMemo(() => {
    const weekStart = addDays(todayISO(), -6)
    const inWeek = allCardio.filter((s) => s.date >= weekStart)
    const distanceKm = inWeek.reduce((sum, s) => sum + (s.distanceKm ?? 0), 0)
    const minutes = inWeek.reduce((sum, s) => sum + sessionDurationMin(s), 0)
    return { count: inWeek.length, distanceKm, minutes }
  }, [allCardio])

  const last = allCardio[0] ?? null
  const weekDistance = units === 'imperial' ? week.distanceKm / 1.60934 : week.distanceKm

  // No cardio ever: a slim, useful prompt rather than an empty card, so cardio is
  // still discoverable for someone who hasn't logged any yet.
  if (allCardio.length === 0) {
    return (
      <Card className="space-y-2">
        <div className="flex items-center gap-2">
          <Activity size={15} className="text-primary-400" />
          <h2 className="text-sm font-semibold text-slate-200">Cardio</h2>
        </div>
        <p className="text-xs text-slate-500">
          Runs, rides, hikes and classes show up here with pace, distance and heart rate. Log one, or import from
          Garmin or Fitbit.
        </p>
        <Button variant="ghost" full onClick={onLog}>
          <span className="flex items-center justify-center gap-1.5">
            <Plus size={15} /> Log activity
          </span>
        </Button>
      </Card>
    )
  }

  const stats: [string, string][] = []
  if (weekDistance > 0) stats.push([`${weekDistance.toFixed(1)}`, distUnit])
  stats.push([formatTotalDuration(week.minutes), 'time'])
  stats.push([String(week.count), week.count === 1 ? 'session' : 'sessions'])

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Activity size={15} className="text-primary-400" />
          <h2 className="text-sm font-semibold text-slate-200">Cardio</h2>
        </div>
        <button
          type="button"
          onClick={onSeeAll}
          className="flex items-center gap-0.5 text-xs font-medium text-emerald-400 active:text-emerald-300"
        >
          See all <ChevronRight size={13} />
        </button>
      </div>

      <div>
        <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">This week</p>
        <div
          className="grid gap-2 text-center"
          style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}
        >
          {stats.map(([value, label]) => (
            <div key={label} className="rounded-xl bg-slate-800/60 py-2.5">
              <p className="text-base font-bold text-slate-100 tabular-nums">{value}</p>
              <p className="text-[11px] text-slate-500">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {last && (
        <button
          type="button"
          onClick={() => setOpenSession(last)}
          className="flex w-full items-center gap-2.5 rounded-lg bg-slate-800/40 px-2.5 py-2 text-left active:bg-slate-800"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-xs font-medium text-slate-100">{last.name}</span>
              <span className="shrink-0 text-[10px] text-slate-500">{dayLabel(last.date)}</span>
            </div>
            <p className="truncate text-[11px] text-slate-400">{cardioSummaryLine(last, units)}</p>
          </div>
          <ChevronRight size={14} className="shrink-0 text-slate-600" />
        </button>
      )}

      <SessionDetail session={openSession} onClose={() => setOpenSession(null)} onRepeated={() => setOpenSession(null)} />
    </Card>
  )
}

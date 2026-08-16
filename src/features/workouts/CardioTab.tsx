// The Cardio tab: a glance-value summary up top (always useful the instant it
// opens), then the full cardio dashboard as collapsible sections so every detail
// is one tap away without being a wall. Reuses the existing dashboard panels; the
// range + sport controls up top drive all of them, same as before.

import { useMemo, useState } from 'react'
import { Activity, ChevronRight, Plus } from 'lucide-react'
import Card from '../../components/Card'
import Button from '../../components/Button'
import Collapsible from '../../components/Collapsible'
import SessionDetail from './SessionDetail'
import CardioProgressSection from './CardioProgressSection'
import RacePredictionSection from './RacePredictionSection'
import ActivityFeedSection from './ActivityFeedSection'
import ActiveTimeSection from '../progress/ActiveTimeSection'
import { useWorkoutsStore } from '../../store/workouts'
import { useSettingsStore } from '../../store/settings'
import { addDays, todayISO } from '../../lib/date'
import {
  CARDIO_RANGE_PRESETS,
  cardioActivities,
  cardioSummaryLine,
  distanceUnitLabel,
  formatTotalDuration,
  isCardioSession,
  sessionDurationMin,
  type ActivityCategory,
  type CardioRange,
} from './cardio'
import type { WorkoutSession } from '../../types'

const KM_PER_MILE = 1.60934

function dayLabel(iso: string): string {
  const today = todayISO()
  if (iso === today) return 'Today'
  if (iso === addDays(today, -1)) return 'Yesterday'
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export default function CardioTab({ onLog }: { onLog: () => void }) {
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
    return {
      count: inWeek.length,
      distanceKm: inWeek.reduce((sum, s) => sum + (s.distanceKm ?? 0), 0),
      minutes: inWeek.reduce((sum, s) => sum + sessionDurationMin(s), 0),
    }
  }, [allCardio])
  const last = allCardio[0] ?? null
  const weekDistance = units === 'imperial' ? week.distanceKm / KM_PER_MILE : week.distanceKm

  // Shared controls that every panel reacts to — one filter, many views.
  const [range, setRange] = useState<CardioRange>({ kind: 'days', days: 90 })
  const [customOpen, setCustomOpen] = useState(false)
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [activeCategory, setActiveCategory] = useState<ActivityCategory | null>(null)

  const activities = useMemo(() => cardioActivities(sessions, range), [sessions, range])
  const stillPresent = activities.some((a) => a.category === activeCategory)
  const selected = (stillPresent ? activeCategory : null) ?? activities[0]?.category ?? null

  if (allCardio.length === 0) {
    return (
      <Card className="space-y-3">
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-primary-400" />
          <h2 className="text-sm font-semibold text-slate-200">Cardio</h2>
        </div>
        <p className="text-sm text-slate-400">
          Runs, rides, hikes and classes show up here with pace, distance, heart rate and trends over time. Log one,
          or import from Garmin or Fitbit.
        </p>
        <Button variant="primary" full onClick={onLog}>
          <span className="flex items-center justify-center gap-1.5">
            <Plus size={16} /> Log activity
          </span>
        </Button>
      </Card>
    )
  }

  const stats: [string, string][] = []
  if (weekDistance > 0) stats.push([weekDistance.toFixed(1), distUnit])
  stats.push([formatTotalDuration(week.minutes), 'time'])
  stats.push([String(week.count), week.count === 1 ? 'session' : 'sessions'])

  return (
    <div className="space-y-4">
      {/* Glance summary — this week, plus your last activity. */}
      <Card className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Activity size={16} className="text-primary-400" />
            <h2 className="text-sm font-semibold text-slate-200">This week</h2>
          </div>
          <Button variant="ghost" onClick={onLog}>
            <span className="flex items-center gap-1.5 text-xs">
              <Plus size={14} /> Log activity
            </span>
          </Button>
        </div>
        <div
          className="grid gap-2 text-center"
          style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}
        >
          {stats.map(([value, label]) => (
            <div key={label} className="rounded-xl bg-slate-800/60 py-2.5">
              <p className="text-lg font-bold text-slate-100 tabular-nums">{value}</p>
              <p className="text-[11px] text-slate-500">{label}</p>
            </div>
          ))}
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
      </Card>

      {/* Range + sport, driving every section below. */}
      <Card className="space-y-3">
        <div className="flex gap-1.5">
          {CARDIO_RANGE_PRESETS.map((preset) => {
            const active =
              !customOpen &&
              ((preset.range.kind === 'all' && range.kind === 'all') ||
                (preset.range.kind === 'days' && range.kind === 'days' && range.days === preset.range.days))
            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  setCustomOpen(false)
                  setRange(preset.range)
                }}
                className={`flex-1 rounded-full py-1.5 text-[11px] font-medium ${
                  active ? 'bg-slate-700 text-slate-100' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {preset.label}
              </button>
            )
          })}
          <button
            type="button"
            onClick={() => setCustomOpen((v) => !v)}
            className={`flex-1 rounded-full py-1.5 text-[11px] font-medium ${
              customOpen ? 'bg-slate-700 text-slate-100' : 'bg-slate-800 text-slate-400'
            }`}
          >
            Custom
          </button>
        </div>

        {customOpen && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customFrom}
              max={customTo || todayISO()}
              onChange={(e) => {
                setCustomFrom(e.target.value)
                if (e.target.value && customTo) setRange({ kind: 'custom', from: e.target.value, to: customTo })
              }}
              className="min-w-0 flex-1 rounded-lg bg-slate-800 px-2 py-1.5 text-xs text-slate-100 [color-scheme:dark]"
            />
            <span className="text-xs text-slate-500">to</span>
            <input
              type="date"
              value={customTo}
              min={customFrom || undefined}
              max={todayISO()}
              onChange={(e) => {
                setCustomTo(e.target.value)
                if (customFrom && e.target.value) setRange({ kind: 'custom', from: customFrom, to: e.target.value })
              }}
              className="min-w-0 flex-1 rounded-lg bg-slate-800 px-2 py-1.5 text-xs text-slate-100 [color-scheme:dark]"
            />
          </div>
        )}

        {activities.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {activities.map((a) => (
              <button
                key={a.category}
                type="button"
                onClick={() => setActiveCategory(a.category)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap ${
                  selected === a.category ? 'bg-primary-500 font-semibold text-slate-950' : 'bg-slate-800 text-slate-300'
                }`}
              >
                {a.category} <span className="opacity-60">· {a.count}</span>
              </button>
            ))}
          </div>
        )}

        {activities.length === 0 && (
          <p className="text-xs text-slate-500">No cardio activities in this date range. Try a wider range.</p>
        )}
      </Card>

      {selected !== null && (
        <>
          <Collapsible title="Recent activities" subtitle="Every session, with the details" defaultOpen>
            <ActivityFeedSection range={range} category={selected} bare />
          </Collapsible>
          <Collapsible title="Pace & distance" subtitle="How your training is trending" defaultOpen>
            <CardioProgressSection range={range} category={selected} bare />
          </Collapsible>
          <Collapsible title="Active time" subtitle="Minutes per week, all cardio" defaultOpen>
            <ActiveTimeSection bare />
          </Collapsible>
          {selected === 'Run' && (
            <Collapsible title="Race predictions" subtitle="Predicted times and VO₂ from your best effort" defaultOpen>
              <RacePredictionSection range={range} bare />
            </Collapsible>
          )}
        </>
      )}

      <SessionDetail session={openSession} onClose={() => setOpenSession(null)} onRepeated={() => setOpenSession(null)} />
    </div>
  )
}

// The cardio dashboard: one set of controls at the top, every panel below reacting
// to them.
//
// The range picker and sport tabs used to live inside the chart card, which meant
// they could only ever filter the chart. Lifting them here is what lets the
// predictions, the totals and the activity feed all answer the same question —
// "how has my running gone over the last 90 days" — instead of three panels each
// showing a different slice. This is how Strava and Garmin Connect are laid out,
// and the reason is the same: one filter, many views.

import { useMemo, useState } from 'react'
import Card from '../../components/Card'
import { useWorkoutsStore } from '../../store/workouts'
import {
  CARDIO_RANGE_PRESETS,
  cardioActivities,
  type ActivityCategory,
  type CardioRange,
} from './cardio'
import { todayISO } from '../../lib/date'
import CardioProgressSection from './CardioProgressSection'
import RacePredictionSection from './RacePredictionSection'
import ActivityFeedSection from './ActivityFeedSection'

export default function CardioDashboard() {
  const sessions = useWorkoutsStore((s) => s.sessions)

  // 90 days by default: long enough for a trend, short enough that the recent
  // weeks are still legible. "All" is one tap away.
  const [range, setRange] = useState<CardioRange>({ kind: 'days', days: 90 })
  const [customOpen, setCustomOpen] = useState(false)
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [activeCategory, setActiveCategory] = useState<ActivityCategory | null>(null)

  const activities = useMemo(() => cardioActivities(sessions, range), [sessions, range])

  // The chosen sport can vanish when the range narrows — fall back rather than
  // leaving every panel below filtered to a tab that is no longer there.
  const stillPresent = activities.some((a) => a.category === activeCategory)
  const selected = (stillPresent ? activeCategory : null) ?? activities[0]?.category ?? null

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <div className="space-y-2">
          <div className="flex gap-1.5">
            {CARDIO_RANGE_PRESETS.map((preset) => {
              const active =
                !customOpen &&
                ((preset.range.kind === 'all' && range.kind === 'all') ||
                  (preset.range.kind === 'days' &&
                    range.kind === 'days' &&
                    range.days === preset.range.days))
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
                  if (e.target.value && customTo) {
                    setRange({ kind: 'custom', from: e.target.value, to: customTo })
                  }
                }}
                className="min-w-0 flex-1 rounded-lg bg-slate-800 px-2 py-1.5 text-xs text-slate-100"
              />
              <span className="text-xs text-slate-500">to</span>
              <input
                type="date"
                value={customTo}
                min={customFrom || undefined}
                max={todayISO()}
                onChange={(e) => {
                  setCustomTo(e.target.value)
                  if (customFrom && e.target.value) {
                    setRange({ kind: 'custom', from: customFrom, to: e.target.value })
                  }
                }}
                className="min-w-0 flex-1 rounded-lg bg-slate-800 px-2 py-1.5 text-xs text-slate-100"
              />
            </div>
          )}
        </div>

        {/* Sport picker. Wraps rather than scrolling sideways: seven categories fit
            in two rows, and a horizontal scrollbar hid options below the fold. */}
        {activities.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {activities.map((a) => (
              <button
                key={a.category}
                type="button"
                onClick={() => setActiveCategory(a.category)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap ${
                  selected === a.category
                    ? 'bg-primary-500 font-semibold text-slate-950'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                {a.category} <span className="opacity-60">· {a.count}</span>
              </button>
            ))}
          </div>
        )}

        {activities.length === 0 && (
          <p className="text-xs text-slate-500">
            {sessions.length > 0
              ? 'No cardio activities in this date range. Try a wider range.'
              : 'Import cardio activities (walks, runs, rides) from Garmin to track pace, distance and duration over time.'}
          </p>
        )}
      </Card>

      {selected !== null && (
        <>
          <CardioProgressSection range={range} category={selected} />
          {/* Predictions are a running concept. Showing a marathon time next to a
              set of ski laps would be noise. */}
          {selected === 'Run' && <RacePredictionSection range={range} />}
          <ActivityFeedSection range={range} category={selected} />
        </>
      )}
    </div>
  )
}

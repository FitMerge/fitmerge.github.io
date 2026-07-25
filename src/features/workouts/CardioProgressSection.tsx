import { useMemo, useState } from 'react'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Footprints } from 'lucide-react'
import Card from '../../components/Card'
import { useWorkoutsStore } from '../../store/workouts'
import { useSettingsStore } from '../../store/settings'
import {
  CARDIO_RANGE_PRESETS,
  bestEfforts,
  bucketCardio,
  bucketSizeFor,
  cardioActivities,
  cardioSeries,
  cardioSummary,
  distanceUnitLabel,
  formatDuration,
  formatGarminRecord,
  formatPace,
  type ActivityCategory,
  type CardioMetricKey,
  type CardioRange,
} from './cardio'
import { todayISO } from '../../lib/date'
import { monthDayLabel } from '../progress/utils'

type MetricDef = { key: CardioMetricKey; label: string; needsDistance: boolean }

function periodNoun(size: 'week' | 'month'): string {
  return size === 'month' ? 'Month' : 'Week'
}

export default function CardioProgressSection() {
  const sessions = useWorkoutsStore((s) => s.sessions)
  const units = useSettingsStore((s) => s.units)
  const distUnit = distanceUnitLabel(units)

  // 90 days by default: long enough for a trend, short enough that the recent
  // weeks are still legible. "All" is one tap away.
  const [range, setRange] = useState<CardioRange>({ kind: 'days', days: 90 })
  const [customOpen, setCustomOpen] = useState(false)
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  const activities = useMemo(() => cardioActivities(sessions, range), [sessions, range])
  const [activeCategory, setActiveCategory] = useState<ActivityCategory | null>(null)

  // The chosen sport can vanish when the range narrows — fall back rather than
  // showing an empty chart for a tab that is no longer there.
  const stillPresent = activities.some((a) => a.category === activeCategory)
  const selected = (stillPresent ? activeCategory : null) ?? activities[0]?.category ?? null
  const selectedActivity = activities.find((a) => a.category === selected)

  const points = useMemo(
    () => (selected ? cardioSeries(sessions, selected, units, range) : []),
    [sessions, selected, units, range],
  )
  const summary = useMemo(() => cardioSummary(points), [points])

  const metrics: MetricDef[] = [
    { key: 'pace', label: `Pace /${distUnit}`, needsDistance: true },
    { key: 'distance', label: `Distance`, needsDistance: true },
    { key: 'durationMin', label: 'Duration', needsDistance: false },
    { key: 'kcal', label: 'Calories', needsDistance: false },
  ]
  const hasDistance = selectedActivity?.hasDistance ?? false
  const available = metrics.filter((m) => !m.needsDistance || hasDistance)
  const [metric, setMetric] = useState<CardioMetricKey>('pace')
  const activeMetric = available.some((m) => m.key === metric) ? metric : available[0]?.key ?? 'durationMin'

  // How many of the sessions in view actually carry the metric being charted. A
  // Walk tab reading 145 while four dots appear is not a bug, but it reads like
  // one, so the gap is stated rather than left to be inferred.
  const plotted = points.filter((p) => (p[activeMetric] as number | null) !== null).length

  // Everything below must stay above the early return: changing the range can empty
  // and refill the activity list, and a hook that only sometimes runs changes the
  // hook count between renders, which React treats as a fatal error.

  // Weekly or monthly periods, the way Strava and Garmin Connect present this. One
  // bar per period reads at a glance where one dot per session never did, and it
  // removes the outlier problem at source: a half marathon is a tall week, not a
  // spike that rescales the entire axis.
  const bucketSize = bucketSizeFor(range)
  const buckets = useMemo(() => bucketCardio(points, bucketSize), [points, bucketSize])

  // Only running has standard race distances worth comparing against.
  const efforts = useMemo(
    () => (selected === 'Run' ? bestEfforts(sessions, 'Run', units, range) : []),
    [sessions, selected, units, range],
  )

  // Garmin's own records beat anything derivable here: it measures across segments
  // within an activity, so its 5K can come from inside a longer run. All-time by
  // definition, so they sit outside the range filter and say so.
  const garminRecords = useWorkoutsStore((s) => s.garminRecords)
  const runRecords = useMemo(
    () => (selected === 'Run' ? garminRecords.filter((r) => r.typeId <= 7) : []),
    [garminRecords, selected],
  )

  const rangePicker = (
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
              className={`flex-1 rounded-full py-1 text-[11px] font-medium ${
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
          className={`flex-1 rounded-full py-1 text-[11px] font-medium ${
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
  )

  if (activities.length === 0) {
    return (
      <Card className="space-y-3">
        <Header />
        {rangePicker}
        <p className="text-xs text-slate-500">
          {sessions.length > 0
            ? 'No cardio activities in this date range. Try a wider range.'
            : 'Import cardio activities (walks, runs, rides) from Garmin to track pace, distance and duration over time.'}
        </p>
      </Card>
    )
  }

  const fmt = (v: number): string => {
    if (activeMetric === 'pace') return formatPace(v)
    if (activeMetric === 'distance') return v.toFixed(1)
    if (activeMetric === 'durationMin') return formatDuration(v)
    return String(Math.round(v))
  }

  const yLabel =
    activeMetric === 'pace'
      ? `min/${distUnit}`
      : activeMetric === 'distance'
        ? distUnit
        : activeMetric === 'durationMin'
          ? 'min'
          : 'kcal'

  return (
    <Card className="space-y-3">
      <Header />

      {rangePicker}

      {/* Sport picker. Wraps rather than scrolling sideways: seven categories fit in
          two rows, and a horizontal scrollbar hid options below the fold. */}
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

      {/* Metric picker */}
      <div className="flex gap-2">
        {available.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setMetric(m.key)}
            className={`flex-1 rounded-full py-1.5 text-xs font-medium ${
              activeMetric === m.key ? 'bg-slate-700 text-slate-100' : 'bg-slate-800 text-slate-400'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Summary tiles. Total time replaces "best pace" as the third tile: it is
          always available, where pace needs distance and was showing a dash. */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <Tile label="Sessions" value={String(summary.sessions)} />
        <Tile label="Total time" value={formatDuration(summary.totalDuration)} />
        <Tile
          label={`Distance ${distUnit}`}
          value={summary.totalDistance > 0 ? summary.totalDistance.toFixed(1) : '—'}
        />
      </div>

      {buckets.length > 0 ? (
        <div style={{ height: 190 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={buckets} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#1e293b" vertical={false} />
              {/* Categorical is correct here in a way it never was per session: every
                  bar covers an identical period, so equal spacing is the truth. */}
              <XAxis
                dataKey="label"
                tick={{ fill: '#64748b', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                minTickGap={16}
              />
              <YAxis
                tick={{ fill: '#64748b', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={40}
                domain={activeMetric === 'pace' ? ['auto', 'auto'] : [0, 'auto']}
                reversed={activeMetric === 'pace'}
                tickFormatter={fmt}
              />
              <Tooltip
                cursor={{ fill: '#1e293b', fillOpacity: 0.5 }}
                contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#cbd5e1' }}
                formatter={(v: number) => [`${fmt(v)} ${yLabel}`, periodNoun(bucketSize)]}
              />
              {/* Pace is an average, so it stays a line — a bar implies a total you
                  could add up, and averaging is not summing. Everything else is a
                  period total and reads best as a bar. */}
              {activeMetric === 'pace' ? (
                <Line
                  type="linear"
                  dataKey="pace"
                  stroke="#34d399"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#34d399', strokeWidth: 0 }}
                  connectNulls
                  isAnimationActive={false}
                />
              ) : (
                <Bar dataKey={activeMetric} fill="#34d399" radius={[3, 3, 0, 0]} isAnimationActive={false} />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="py-2 text-center text-sm text-slate-500">No sessions in this range yet.</p>
      )}

      <p className="text-center text-[11px] text-slate-500">
        {activeMetric === 'pace'
          ? `Average pace per ${periodNoun(bucketSize).toLowerCase()} — lower is faster.`
          : `Total per ${periodNoun(bucketSize).toLowerCase()}.`}
      </p>

      {/* Garmin's records when we have them: it measures inside activities, so its
          5K beats anything derivable from one distance per session. */}
      {runRecords.length > 0 ? (
        <div className="space-y-1.5 border-t border-slate-800 pt-2.5">
          <p className="text-[11px] font-medium text-slate-400">Personal records · all time</p>
          <div className="grid grid-cols-2 gap-2">
            {runRecords.map((record) => (
              <div key={record.typeId} className="rounded-xl bg-slate-800/60 p-2.5">
                <div className="flex items-baseline justify-between gap-1">
                  <span className="truncate text-[11px] font-semibold text-primary-400">
                    {record.label}
                  </span>
                  {record.date && (
                    <span className="shrink-0 text-[10px] text-slate-500">
                      {monthDayLabel(record.date)}
                    </span>
                  )}
                </div>
                <p className="text-base font-bold text-slate-100 tabular-nums">
                  {formatGarminRecord(record, units)}
                </p>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-500">
            From Garmin, including efforts inside longer activities.
          </p>
        </div>
      ) : (
        // Fallback until a sync brings Garmin's records in: whole sessions matched
        // to standard distances, which is all the imported data can support.
        efforts.length > 0 && (
          <div className="space-y-1.5 border-t border-slate-800 pt-2.5">
            <p className="text-[11px] font-medium text-slate-400">Best efforts</p>
            <div className="grid grid-cols-2 gap-2">
              {efforts.map((effort) => (
                <div key={effort.label} className="rounded-xl bg-slate-800/60 p-2.5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] font-semibold text-primary-400">{effort.label}</span>
                    <span className="text-[10px] text-slate-500">{monthDayLabel(effort.date)}</span>
                  </div>
                  <p className="text-base font-bold text-slate-100 tabular-nums">
                    {formatDuration(effort.durationMin)}
                  </p>
                  <p className="text-[10px] text-slate-500 tabular-nums">
                    {formatPace(effort.pace)} /{distUnit}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )
      )}

      {/* Why the tab count and the number of plotted points can disagree. */}
      {plotted > 0 && plotted < points.length && (
        <p className="text-[11px] text-slate-500">
          Charting {plotted} of {points.length} sessions — the rest have no{' '}
          {activeMetric === 'kcal' ? 'calorie' : activeMetric === 'durationMin' ? 'duration' : 'distance'}{' '}
          data recorded.
        </p>
      )}

      {!hasDistance && (
        <p className="text-[11px] text-slate-500">
          No distance recorded for these activities, so pace and distance charts are hidden.
          Older sessions can be filled in with a backfill from Settings → Pull from Garmin.
        </p>
      )}
    </Card>
  )
}

function Header() {
  return (
    <div className="flex items-center gap-2">
      <Footprints size={16} className="text-primary-400" />
      <h2 className="text-sm font-semibold text-slate-200">Cardio progress</h2>
    </div>
  )
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-800/60 p-2.5">
      <p className="text-lg font-bold text-slate-100 tabular-nums">{value}</p>
      <p className="text-[10px] text-slate-500">{label}</p>
    </div>
  )
}

import { useMemo, useState } from 'react'
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ResponsiveContainer,
  Scatter,
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
  cardioActivities,
  cardioSeries,
  cardioSummary,
  distanceUnitLabel,
  formatDuration,
  formatGarminRecord,
  formatPace,
  hasOutlierSpike,
  type ActivityCategory,
  type CardioMetricKey,
  type CardioRange,
} from './cardio'
import { todayISO } from '../../lib/date'
import { monthDayLabel } from '../progress/utils'

type MetricDef = { key: CardioMetricKey; label: string; needsDistance: boolean }

/** Axis tick: short enough to fit several across a phone. */
function axisDate(t: number): string {
  return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** Tooltip heading: the full date, since the axis only had room for a hint. */
function tooltipDate(t: number): string {
  return new Date(t).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
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

  // Session-to-session values bounce around (route, weather, mood) — a rolling
  // 5-session average is the bold trend, raw sessions become faint dots behind it.
  const chartPoints = useMemo(() => {
    const vals = points.map((p) => p[activeMetric] as number | null)
    return points.map((p, i) => {
      let sum = 0
      let n = 0
      for (let j = Math.max(0, i - 4); j <= i; j++) {
        const v = vals[j]
        if (v != null) {
          sum += v
          n++
        }
      }
      return { ...p, trend: n ? sum / n : null }
    })
  }, [points, activeMetric])

  // Best session: fastest pace, or the highest value for other metrics.
  const best = useMemo(() => {
    let bestPt: { t: number; v: number } | null = null
    for (const p of chartPoints) {
      const v = p[activeMetric] as number | null
      if (v == null) continue
      const better = bestPt === null || (activeMetric === 'pace' ? v < bestPt.v : v > bestPt.v)
      if (better) bestPt = { t: p.t, v }
    }
    return bestPt
  }, [chartPoints, activeMetric])

  // One half marathon among a season of 5k runs pins every other point to the floor.
  // A square-root axis compresses the spike while keeping real numbers on the ticks —
  // a log axis would read 3.2 / 10 / 31.6, which nobody wants for distance. Pace is
  // left alone: its range is narrow and the axis is already reversed.
  const easeSpikes = useMemo(
    () =>
      activeMetric !== 'pace' &&
      hasOutlierSpike(points.map((p) => p[activeMetric] as number | null)),
    [points, activeMetric],
  )

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

      {/* Sport picker — major categories only, so runs from every city sit together */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {activities.map((a) => (
          <button
            key={a.category}
            type="button"
            onClick={() => setActiveCategory(a.category)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap ${
              selected === a.category
                ? 'bg-primary-500 text-slate-950 font-semibold'
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

      {/* Summary tiles */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <Tile label="Sessions" value={String(summary.sessions)} />
        <Tile
          label={`Distance ${distUnit}`}
          value={summary.totalDistance > 0 ? summary.totalDistance.toFixed(1) : '—'}
        />
        <Tile
          label={`Best pace`}
          value={summary.bestPace !== null ? `${formatPace(summary.bestPace)}` : '—'}
        />
      </div>

      {points.length >= 2 ? (
        <div style={{ height: 190 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartPoints} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#1e293b" vertical={false} />
              {/* A real time axis: gaps between sessions are drawn to scale and the
                  ticks fall on sensible dates rather than on whichever session
                  happened to sit there. */}
              <XAxis
                dataKey="t"
                type="number"
                scale="time"
                domain={['dataMin', 'dataMax']}
                tickFormatter={axisDate}
                tick={{ fill: '#64748b', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                minTickGap={32}
              />
              <YAxis
                tick={{ fill: '#64748b', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={40}
                scale={easeSpikes ? 'sqrt' : 'linear'}
                domain={easeSpikes ? [0, 'auto'] : ['auto', 'auto']}
                reversed={activeMetric === 'pace'}
                tickFormatter={fmt}
              />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#cbd5e1' }}
                labelFormatter={(t: number) => tooltipDate(t)}
                formatter={(v: number, name: string) => [`${fmt(v)} ${yLabel}`, name]}
              />
              {/* Individual sessions as slate dots — no connecting line, because
                  nothing happened between two runs a fortnight apart. */}
              <Scatter
                dataKey={activeMetric}
                name="Session"
                fill="#94a3b8"
                fillOpacity={0.65}
                isAnimationActive={false}
              />
              {/* The story: rolling 5-session average, in emerald so it reads as a
                  different thing entirely rather than a bolder version of the dots.
                  Straight segments: the average is only defined where a session is. */}
              <Line
                type="linear"
                dataKey="trend"
                name="5-session average"
                stroke="#34d399"
                strokeWidth={2.5}
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
              {best && (
                <ReferenceDot
                  x={best.t}
                  y={best.v}
                  r={4}
                  fill="#fbbf24"
                  stroke="#0f172a"
                  strokeWidth={1.5}
                  label={{ value: 'best', position: 'top', fill: '#fbbf24', fontSize: 10 }}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="py-2 text-center text-sm text-slate-500">Not enough sessions to chart a trend yet.</p>
      )}

      {activeMetric === 'pace' && <p className="text-center text-[11px] text-slate-500">Lower is faster.</p>}

      {easeSpikes && (
        <p className="text-center text-[11px] text-slate-500">
          Axis eased so one long session doesn&apos;t flatten the rest. Values are unchanged.
        </p>
      )}

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

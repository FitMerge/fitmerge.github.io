import { useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Footprints } from 'lucide-react'
import Card from '../../components/Card'
import { useWorkoutsStore } from '../../store/workouts'
import { useSettingsStore } from '../../store/settings'
import {
  cardioActivities,
  cardioSeries,
  cardioSummary,
  distanceUnitLabel,
  formatPace,
  type CardioMetricKey,
} from './cardio'

type MetricDef = { key: CardioMetricKey; label: string; needsDistance: boolean }

export default function CardioProgressSection() {
  const sessions = useWorkoutsStore((s) => s.sessions)
  const units = useSettingsStore((s) => s.units)
  const distUnit = distanceUnitLabel(units)

  const activities = useMemo(() => cardioActivities(sessions), [sessions])
  const [activeName, setActiveName] = useState<string | null>(null)

  const selected = activeName ?? activities[0]?.name ?? null
  const selectedActivity = activities.find((a) => a.name === selected)

  const points = useMemo(
    () => (selected ? cardioSeries(sessions, selected, units) : []),
    [sessions, selected, units],
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

  if (activities.length === 0) {
    return (
      <Card className="space-y-2">
        <Header />
        <p className="text-xs text-slate-500">
          Import cardio activities (walks, runs, rides) from Garmin to track pace, distance and duration
          over time.
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

      {/* Activity type picker */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {activities.slice(0, 8).map((a) => (
          <button
            key={a.name}
            type="button"
            onClick={() => setActiveName(a.name)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap ${
              selected === a.name ? 'bg-primary-500 text-slate-950 font-semibold' : 'bg-slate-800 text-slate-300'
            }`}
          >
            {a.name} <span className="opacity-60">· {a.count}</span>
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
            <LineChart data={points} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#1e293b" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={24} />
              <YAxis
                tick={{ fill: '#64748b', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={40}
                domain={['auto', 'auto']}
                reversed={activeMetric === 'pace'}
                tickFormatter={fmt}
              />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#cbd5e1' }}
                formatter={(v: number) => [`${fmt(v)} ${yLabel}`, activeMetric === 'pace' ? 'Pace' : activeMetric === 'durationMin' ? 'Duration' : activeMetric === 'distance' ? 'Distance' : 'Calories']}
              />
              <Line
                type="monotone"
                dataKey={activeMetric}
                stroke="#34d399"
                strokeWidth={2}
                dot={{ r: 2.5, fill: '#34d399' }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="py-2 text-center text-sm text-slate-500">Not enough sessions to chart a trend yet.</p>
      )}

      {activeMetric === 'pace' && <p className="text-center text-[11px] text-slate-500">Lower is faster.</p>}

      {!hasDistance && (
        <p className="text-[11px] text-slate-500">
          No distance data for this activity yet. Re-run <code className="rounded bg-slate-800 px-1">garmin-sync.py</code>{' '}
          and re-import to unlock pace &amp; distance charts.
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

// Volume and pace over time for one sport, aggregated into weekly or monthly
// periods.
//
// Controlled by CardioDashboard: the range and the sport come in as props so this
// card, the race predictions and the activity feed all describe the same slice of
// history. It owns only which metric is being charted.

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
import { Footprints, TrendingDown, TrendingUp } from 'lucide-react'
import Card from '../../components/Card'
import { useWorkoutsStore } from '../../store/workouts'
import { useSettingsStore } from '../../store/settings'
import {
  bestEfforts,
  bucketCardio,
  bucketSizeFor,
  cardioActivities,
  cardioSeries,
  cardioSummary,
  compareSummaries,
  distanceUnitLabel,
  elevationUnitLabel,
  formatDuration,
  formatTotalDuration,
  formatGarminRecord,
  formatPace,
  previousRange,
  toDisplayElevation,
  type ActivityCategory,
  type CardioMetricKey,
  type CardioRange,
} from './cardio'
import { monthDayLabel } from '../progress/utils'

type MetricDef = { key: CardioMetricKey; label: string; needsDistance: boolean; needsElevation?: boolean }

function periodNoun(size: 'week' | 'month'): string {
  return size === 'month' ? 'Month' : 'Week'
}

export default function CardioProgressSection({
  range,
  category,
}: {
  range: CardioRange
  category: ActivityCategory
}) {
  const sessions = useWorkoutsStore((s) => s.sessions)
  const garminRecords = useWorkoutsStore((s) => s.garminRecords)
  const units = useSettingsStore((s) => s.units)
  const distUnit = distanceUnitLabel(units)

  const points = useMemo(
    () => cardioSeries(sessions, category, units, range),
    [sessions, category, units, range],
  )
  const summary = useMemo(() => cardioSummary(points), [points])

  // The same totals over the window immediately before this one. "Up 12% on the
  // previous 90 days" is the line that makes a totals row worth reading.
  const comparison = useMemo(() => {
    const prev = previousRange(range)
    if (prev === null) return null
    const prevSummary = cardioSummary(cardioSeries(sessions, category, units, prev))
    if (prevSummary.sessions === 0 && summary.sessions === 0) return null
    return compareSummaries(summary, prevSummary, distUnit)
  }, [sessions, category, units, range, summary, distUnit])

  const elevUnit = elevationUnitLabel(units)

  const bucketSize = bucketSizeFor(range)
  const buckets = useMemo(() => bucketCardio(points, bucketSize), [points, bucketSize])

  // Only running has standard race distances worth comparing against.
  const efforts = useMemo(
    () => (category === 'Run' ? bestEfforts(sessions, 'Run', units, range) : []),
    [sessions, category, units, range],
  )

  // Garmin's own records beat anything derivable here: it measures across segments
  // within an activity, so its 5K can come from inside a longer run. All-time by
  // definition, so they sit outside the range filter and say so.
  const runRecords = useMemo(
    () => (category === 'Run' ? garminRecords.filter((r) => r.typeId <= 7) : []),
    [garminRecords, category],
  )

  const hasDistance = useMemo(
    () => cardioActivities(sessions, range).find((a) => a.category === category)?.hasDistance ?? false,
    [sessions, range, category],
  )

  const metrics: MetricDef[] = [
    { key: 'distance', label: 'Distance', needsDistance: true },
    { key: 'pace', label: `Pace /${distUnit}`, needsDistance: true },
    { key: 'durationMin', label: 'Time', needsDistance: false },
    { key: 'kcal', label: 'Calories', needsDistance: false },
    // Ascent only makes sense where the sport climbs — the same rule the headline
    // tile already follows, so a pool swim never offers an empty elevation chart.
    { key: 'elevation', label: 'Ascent', needsDistance: false, needsElevation: true },
  ]
  const hasElevation = summary.totalElevationM !== null
  const available = metrics.filter(
    (m) => (!m.needsDistance || hasDistance) && (!m.needsElevation || hasElevation),
  )
  // Distance first: it is the number runners and riders actually track. Pace is a
  // tap away, and is the only one of the four that is an average rather than a total.
  const [metric, setMetric] = useState<CardioMetricKey>('distance')
  const activeMetric = available.some((m) => m.key === metric) ? metric : available[0]?.key ?? 'durationMin'

  // How many of the sessions in view actually carry the metric being charted. A
  // Walk tab reading 145 while four dots appear is not a bug, but it reads like
  // one, so the gap is stated rather than left to be inferred.
  // The bucket key and the per-session field differ for ascent (`elevationGainM`),
  // so map rather than indexing by the metric key — otherwise every session counts
  // as plotted and the honesty note below silently stops appearing.
  const plotted = points.filter((p) => {
    const v = activeMetric === 'elevation' ? p.elevationGainM : (p[activeMetric] as number | null | undefined)
    return v !== null && v !== undefined
  }).length

  const fmt = (v: number): string => {
    if (activeMetric === 'pace') return formatPace(v)
    if (activeMetric === 'distance') return v.toFixed(1)
    // A period total of training is hours, not a stopwatch reading: "4h 14m" beats
    // "4:14:00" both on the axis, where width is scarce, and in the tooltip.
    if (activeMetric === 'durationMin') return formatTotalDuration(v)
    // Ascent is stored in metres; convert only here, at the display edge.
    if (activeMetric === 'elevation') return Math.round(toDisplayElevation(v, units)).toLocaleString()
    return String(Math.round(v))
  }

  // Blank for duration, whose formatter already carries its own units.
  const yLabel =
    activeMetric === 'pace'
      ? `min/${distUnit}`
      : activeMetric === 'distance'
        ? distUnit
        : activeMetric === 'durationMin'
          ? ''
          : activeMetric === 'elevation'
            ? elevUnit
            : 'kcal'

  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-2">
        <Footprints size={16} className="text-primary-400" />
        <h2 className="text-sm font-semibold text-slate-200">{category} progress</h2>
      </div>

      {/* Headline totals. Ascent joins them for sports that climb, and drops out
          entirely rather than showing a dash for the ones that don't. */}
      <div
        className={`grid gap-2 text-center ${
          summary.totalElevationM !== null ? 'grid-cols-4' : 'grid-cols-3'
        }`}
      >
        <Tile label="Sessions" value={String(summary.sessions)} />
        <Tile label="Time" value={formatTotalDuration(summary.totalDuration)} />
        <Tile
          label={distUnit}
          value={summary.totalDistance > 0 ? summary.totalDistance.toFixed(1) : '—'}
        />
        {summary.totalElevationM !== null && (
          <Tile
            label={`Ascent ${elevUnit}`}
            value={Math.round(toDisplayElevation(summary.totalElevationM, units)).toLocaleString()}
          />
        )}
      </div>

      {comparison !== null && (
        <div className="space-y-1 rounded-xl bg-slate-800/40 p-2.5">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">
            vs the previous {rangeNoun(range)}
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {comparison.map((d) => (
              <span key={d.label} className="flex items-center gap-1 text-[11px]">
                <span className="text-slate-500">{d.label.replace(/ \(.*\)/, '')}</span>
                {d.changePct === null ? (
                  <span className="text-slate-400">new</span>
                ) : (
                  <span
                    className={`flex items-center gap-0.5 font-medium tabular-nums ${
                      d.changePct > 0.005
                        ? 'text-emerald-400'
                        : d.changePct < -0.005
                          ? 'text-amber-400'
                          : 'text-slate-400'
                    }`}
                  >
                    {d.changePct > 0.005 ? (
                      <TrendingUp size={11} />
                    ) : d.changePct < -0.005 ? (
                      <TrendingDown size={11} />
                    ) : null}
                    {d.changePct > 0 ? '+' : ''}
                    {Math.round(d.changePct * 100)}%
                  </span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

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
                width={activeMetric === 'durationMin' ? 52 : 40}
                domain={activeMetric === 'pace' ? ['auto', 'auto'] : [0, 'auto']}
                reversed={activeMetric === 'pace'}
                tickFormatter={fmt}
              />
              <Tooltip
                cursor={{ fill: '#1e293b', fillOpacity: 0.5 }}
                contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#cbd5e1' }}
                formatter={(v: number) => [`${fmt(v)}${yLabel ? ` ${yLabel}` : ''}`, periodNoun(bucketSize)]}
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
          {activeMetric === 'kcal'
            ? 'calorie'
            : activeMetric === 'durationMin'
              ? 'duration'
              : activeMetric === 'elevation'
                ? 'ascent'
                : 'distance'}{' '}
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

/** How to name the comparison window in "vs the previous ___". */
function rangeNoun(range: CardioRange): string {
  if (range.kind === 'days') {
    if (range.days === 30) return 'month'
    if (range.days === 365) return 'year'
    return `${range.days} days`
  }
  return 'period'
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-800/60 p-2.5">
      <p className="text-lg font-bold text-slate-100 tabular-nums">{value}</p>
      <p className="text-[10px] text-slate-500">{label}</p>
    </div>
  )
}

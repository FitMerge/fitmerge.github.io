import { useEffect, useMemo, useState } from 'react'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  XAxis,
  YAxis,
} from 'recharts'
import { TrendingDown, TrendingUp } from 'lucide-react'
import Sheet from '../../components/Sheet'
import SegmentedControl from '../../components/SegmentedControl'
import ScrubChart from '../../components/ScrubChart'
import { formatMetric, metricAxisValue, metricMeta } from '../../lib/healthMetrics'
import {
  HEALTH_RANGE_OPTIONS,
  bandPosition,
  metricSamples,
  metricSeries,
  metricStats,
  typicalRange,
  withMovingAverage,
  type HealthRangeKey,
} from './healthTrends'
import type { HealthDay } from '../../types'

type Props = {
  metricKey: string | null
  /** Other metrics in the same family, so a consolidated tile can still reach
   * every reading it folded in. Empty for a standalone metric. */
  siblings?: string[]
  days: Record<string, HealthDay>
  onClose: () => void
}

export default function HealthMetricDetailSheet({ metricKey, siblings = [], days, onClose }: Props) {
  const [range, setRange] = useState<HealthRangeKey>('90d')
  // Which member of the family is charted. Seeded from the tile's headline and
  // reset whenever a different tile is opened, so reopening never lands on the
  // sub-metric you last drilled into.
  const [active, setActive] = useState<string | null>(metricKey)
  useEffect(() => setActive(metricKey), [metricKey])

  const charted = active ?? metricKey
  const meta = charted ? metricMeta(charted) : null
  const slow = !!meta?.slow
  const samples = useMemo(() => (charted ? metricSamples(days, charted) : []), [days, charted])
  const series = useMemo(() => {
    const base = metricSeries(samples, range)
    // Slow metrics (VO₂ max, Fitness age) get no moving average — a smoothed curve
    // over a value that only steps occasionally reads as noise.
    const withAvg = slow ? base.map((p) => ({ ...p, avg: null })) : withMovingAverage(base)
    // Flag each point where the value actually changed, so a stepped line can mark
    // the changes with a dot instead of dotting every identical day.
    let prev: number | null = null
    return withAvg.map((p) => {
      let changed = false
      if (p.value !== null) {
        changed = prev === null || p.value !== prev
        prev = p.value
      }
      return { ...p, changed }
    })
  }, [samples, range, slow])
  const stats = useMemo(() => metricStats(samples, range), [samples, range])
  // A "typical range" only means something for a metric that varies day to day; for
  // a stepped one it is noise, so skip the band entirely.
  const band = useMemo(() => (slow ? null : typicalRange(samples, range)), [samples, range, slow])

  const hasPoints = series.some((p) => p.value !== null)
  // Show the 7-day smoothing line only for noisy day-by-day ranges, never for slow metrics.
  const showAvg = !slow && (range === '30d' || range === '90d')

  const delta = stats ? stats.last - stats.first : 0
  const improving = meta?.lowerIsBetter ? delta < 0 : delta > 0
  const meaningful = stats ? Math.abs(delta) > Math.abs(stats.avg) * 0.01 : false

  // Where the latest reading sits vs the user's own normal — the headline read.
  const pos = stats && band ? bandPosition(stats.last, band) : null
  const posLabel =
    pos === 'above' ? 'above your typical range' : pos === 'below' ? 'below your typical range' : 'within your typical range'

  return (
    <Sheet open={metricKey !== null} onClose={onClose} title={meta?.label ?? 'Metric'}>
      {charted && (
        <div className="space-y-4">
          {/* Every reading the tile folded in, still one tap away. Without this,
              consolidating families would genuinely lose data rather than just
              stop shouting it. */}
          {siblings.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {siblings.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setActive(k)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                    charted === k ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {metricMeta(k).label}
                </button>
              ))}
            </div>
          )}

          <SegmentedControl
            size="sm"
            options={HEALTH_RANGE_OPTIONS}
            value={range}
            onChange={setRange}
            ariaLabel="History range"
          />

          {hasPoints && stats ? (
            <>
              <div className="grid grid-cols-3 gap-2">
                <Stat label="Average" value={formatMetric(charted, stats.avg)} />
                <Stat label="Low" value={formatMetric(charted, stats.min)} />
                <Stat label="High" value={formatMetric(charted, stats.max)} />
              </div>

              {band && (
                <div className="rounded-lg bg-slate-800/60 px-3 py-2 text-xs text-slate-300">
                  Latest <span className="font-semibold text-slate-100">{formatMetric(charted, stats.last)}</span> ·{' '}
                  <span className={pos === 'within' ? 'text-slate-400' : 'text-sky-300'}>{posLabel}</span>
                  <span className="text-slate-500">
                    {' '}
                    ({formatMetric(charted, band.low)}–{formatMetric(charted, band.high)})
                  </span>
                </div>
              )}

              {meaningful && (
                <div
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium ${
                    improving ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                  }`}
                >
                  {delta > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  {delta > 0 ? '+' : ''}
                  {formatMetric(charted, delta)} over this range
                  <span className="text-slate-500">· {improving ? 'improving' : 'worsening'}</span>
                </div>
              )}

              <ScrubChart
                data={series}
                height={200}
                label={(p) => p.label}
                values={(p) =>
                  p.value === null
                    ? []
                    : [
                        { key: 'value', value: formatMetric(charted, p.value) },
                        ...(showAvg && p.avg != null
                          ? [{ key: 'avg', name: '7d', value: formatMetric(charted, p.avg), color: '#38bdf8' }]
                          : []),
                      ]
                }
              >
                <ComposedChart data={series} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="metricFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#34d399" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#1e293b" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      minTickGap={24}
                    />
                    <YAxis
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      // Pad a slow metric's axis so a ±1 step doesn't fill the whole
                      // height and read as a spike; let others auto-fit.
                      domain={slow ? [(min: number) => Math.floor(min - 2), (max: number) => Math.ceil(max + 2)] : ['auto', 'auto']}
                      width={48}
                      tickFormatter={(v: number) => metricAxisValue(charted, v)}
                    />
                    {/* Typical-range band (15th–85th pct) + median = "your normal". */}
                    {band && (
                      <ReferenceArea
                        y1={band.low}
                        y2={band.high}
                        fill="#64748b"
                        fillOpacity={0.14}
                        stroke="none"
                        ifOverflow="extendDomain"
                      />
                    )}
                    {band && (
                      <ReferenceLine y={band.mid} stroke="#64748b" strokeDasharray="4 3" ifOverflow="extendDomain" />
                    )}
                    {slow ? (
                      // A stepped line that holds each value until it changes, with a
                      // dot only where it stepped — how Garmin draws VO₂ max.
                      <Line
                        type="stepAfter"
                        dataKey="value"
                        stroke="#34d399"
                        strokeWidth={2}
                        dot={({ key, ...props }: DotProps & { key?: string | number }) => (
                          <ChangeDot key={key ?? props.index} {...props} />
                        )}
                        activeDot={{ r: 4 }}
                        connectNulls
                        isAnimationActive={false}
                      />
                    ) : (
                      <>
                        <Area
                          type="monotone"
                          dataKey="value"
                          stroke="#34d399"
                          strokeWidth={2}
                          fill="url(#metricFill)"
                          dot={false}
                          connectNulls
                          isAnimationActive={false}
                        />
                        {showAvg && (
                          <Line
                            type="monotone"
                            dataKey="avg"
                            stroke="#38bdf8"
                            strokeWidth={1.5}
                            strokeDasharray="4 3"
                            dot={false}
                            connectNulls
                            isAnimationActive={false}
                          />
                        )}
                      </>
                    )}
                </ComposedChart>
              </ScrubChart>

              <p className="text-center text-xs text-slate-500">
                {stats.count} day{stats.count === 1 ? '' : 's'} of data
                {band ? ' · shaded = your typical range' : ''}
                {slow
                  ? ' · dots mark each change'
                  : showAvg
                    ? ' · dashed blue = 7-day average'
                    : range === '1y'
                      ? ' · weekly average'
                      : ' · monthly average'}
              </p>
            </>
          ) : (
            <p className="py-8 text-center text-sm text-slate-500">No data in this range.</p>
          )}
        </div>
      )}
    </Sheet>
  )
}

type DotProps = { cx?: number; cy?: number; index?: number; payload?: { changed?: boolean } }

/** A dot drawn only where a stepped metric actually changed value. */
function ChangeDot({ cx, cy, payload }: DotProps) {
  if (cx == null || cy == null || !payload?.changed) return <g />
  return <circle cx={cx} cy={cy} r={3.5} fill="#34d399" stroke="#0f172a" strokeWidth={1} />
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-800/60 p-2.5 text-center">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm font-bold text-slate-100">{value}</p>
    </div>
  )
}

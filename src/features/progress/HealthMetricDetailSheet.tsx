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
import { familyFor, formatMetric, metricAxisValue, metricMeta } from '../../lib/healthMetrics'
import {
  HEALTH_RANGE_OPTIONS,
  bandPosition,
  metricSamples,
  metricSeries,
  metricStats,
  rangeBandSeries,
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

  // Range families (Body Battery, stress, SpO₂, respiration) each swing within a day,
  // so on their headline metric we chart the daily low→high band instead of a single
  // "most recent value" line — the way Garmin shows it.
  const family = useMemo(() => (charted ? familyFor(charted) : undefined), [charted])
  const isRangePrimary = !!(family && family.kind === 'range' && family.primary === charted && family.low && family.high)
  const bandSeries = useMemo(
    () => (isRangePrimary ? rangeBandSeries(days, family!.low!, family!.high!, range) : []),
    [isRangePrimary, days, family, range],
  )
  const useBand = isRangePrimary && bandSeries.some((p) => p.range !== null)
  const lowStats = useMemo(
    () => (useBand ? metricStats(metricSamples(days, family!.low!), range) : null),
    [useBand, days, family, range],
  )
  const highStats = useMemo(
    () => (useBand ? metricStats(metricSamples(days, family!.high!), range) : null),
    [useBand, days, family, range],
  )
  // The range each end normally sits in — a faint band behind its line.
  const highBand = useMemo(
    () => (useBand ? typicalRange(metricSamples(days, family!.high!), range) : null),
    [useBand, days, family, range],
  )
  const lowBand = useMemo(
    () => (useBand ? typicalRange(metricSamples(days, family!.low!), range) : null),
    [useBand, days, family, range],
  )

  const chartData = useBand ? bandSeries : series
  const hasPoints = useBand ? bandSeries.some((p) => p.range !== null) : series.some((p) => p.value !== null)
  // Show the 7-day smoothing line only for noisy day-by-day ranges — never for slow
  // metrics, nor ones whose normal-range band already gives the context.
  const showAvg = !slow && !meta?.noMovingAverage && (range === '30d' || range === '90d')

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
          {/* In band mode the one high/low chart is the whole story, so the sibling
              chips (charged/drained) are hidden to cut clutter. */}
          {!useBand && siblings.length > 1 && (
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

          {hasPoints ? (
            <>
              {useBand ? (
                <div className="grid grid-cols-3 gap-2">
                  <Stat label="Avg high" color="#34d399" value={highStats ? formatMetric(charted, highStats.avg) : '—'} />
                  <Stat label="Avg low" color="#f87171" value={lowStats ? formatMetric(charted, lowStats.avg) : '—'} />
                  <Stat label="Lowest" value={lowStats ? formatMetric(charted, lowStats.min) : '—'} />
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  <Stat label="Average" value={stats ? formatMetric(charted, stats.avg) : '—'} />
                  <Stat label="Low" value={stats ? formatMetric(charted, stats.min) : '—'} />
                  <Stat label="High" value={stats ? formatMetric(charted, stats.max) : '—'} />
                </div>
              )}

              {!useBand && band && stats && (
                <div className="rounded-lg bg-slate-800/60 px-3 py-2 text-xs text-slate-300">
                  Latest <span className="font-semibold text-slate-100">{formatMetric(charted, stats.last)}</span> ·{' '}
                  <span className={pos === 'within' ? 'text-slate-400' : 'text-sky-300'}>{posLabel}</span>
                  <span className="text-slate-500">
                    {' '}
                    ({formatMetric(charted, band.low)}–{formatMetric(charted, band.high)})
                  </span>
                </div>
              )}

              {!useBand && meaningful && stats && (
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
                data={chartData as any}
                height={200}
                label={(p) => p.label}
                values={(p: any) =>
                  useBand
                    ? p.high === null && p.low === null
                      ? []
                      : [
                          ...(p.high !== null
                            ? [{ key: 'high', name: 'high', value: formatMetric(charted, p.high), color: '#34d399' }]
                            : []),
                          ...(p.low !== null
                            ? [{ key: 'low', name: 'low', value: formatMetric(charted, p.low), color: '#f87171' }]
                            : []),
                        ]
                    : p.value === null
                      ? []
                      : [
                          { key: 'value', value: formatMetric(charted, p.value) },
                          ...(showAvg && p.avg != null
                            ? [{ key: 'avg', name: '7d', value: formatMetric(charted, p.avg), color: '#38bdf8' }]
                            : []),
                        ]
                }
              >
                <ComposedChart data={chartData as any} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
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
                    {/* Typical-range band (15th–85th pct) + median = "your normal".
                        Hidden in band mode, where the chart itself is a range. */}
                    {!useBand && band && (
                      <ReferenceArea
                        y1={band.low}
                        y2={band.high}
                        fill="#64748b"
                        fillOpacity={0.14}
                        stroke="none"
                        ifOverflow="extendDomain"
                      />
                    )}
                    {!useBand && band && (
                      <ReferenceLine y={band.mid} stroke="#64748b" strokeDasharray="4 3" ifOverflow="extendDomain" />
                    )}
                    {useBand ? (
                      // Two lines — daily high (green) and daily low (red) — each over
                      // a faint band showing the range that end normally sits in.
                      <>
                        {highBand && (
                          <ReferenceArea y1={highBand.low} y2={highBand.high} fill="#34d399" fillOpacity={0.1} stroke="none" ifOverflow="extendDomain" />
                        )}
                        {lowBand && (
                          <ReferenceArea y1={lowBand.low} y2={lowBand.high} fill="#f87171" fillOpacity={0.1} stroke="none" ifOverflow="extendDomain" />
                        )}
                        <Line type="monotone" dataKey="high" name="high" stroke="#34d399" strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
                        <Line type="monotone" dataKey="low" name="low" stroke="#f87171" strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
                      </>
                    ) : slow ? (
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
                {(() => {
                  const n = stats?.count ?? bandSeries.filter((p) => p.range !== null).length
                  return `${n} day${n === 1 ? '' : 's'} of data`
                })()}
                {useBand
                  ? ' · green = daily high, red = daily low · shaded = your normal range'
                  : (band ? ' · shaded = your normal range' : '') +
                    (slow
                      ? ' · dots mark each change'
                      : showAvg
                        ? ' · dashed blue = 7-day average'
                        : range === '1y'
                          ? ' · weekly average'
                          : range === 'all'
                            ? ' · monthly average'
                            : '')}
              </p>

              <ValuesTable
                metricKey={charted}
                rows={chartData as any}
                useBand={useBand}
                aggregated={range === '1y' || range === 'all'}
                periodLabel={range === '1y' ? 'week of' : range === 'all' ? 'month of' : ''}
              />
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

/** Readable date from an ISO 'YYYY-MM-DD' (parsed as local, not UTC). */
function fullDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

type TableRow = {
  date: string
  value?: number | null
  low?: number | null
  high?: number | null
}

/**
 * The raw numbers behind the chart, newest-first, in a scrollable table —
 * so a value you can only eyeball on the line can be read exactly. Collapsed by
 * default to keep the sheet short; `aggregated` ranges (1y/all) are bucket
 * averages, which the header calls out.
 */
function ValuesTable({
  metricKey,
  rows,
  useBand,
  aggregated,
  periodLabel,
}: {
  metricKey: string
  rows: TableRow[]
  useBand: boolean
  aggregated: boolean
  periodLabel: string
}) {
  const data = useMemo(
    () =>
      rows
        .filter((r) => (useBand ? r.low != null || r.high != null : r.value != null))
        .slice()
        .reverse(),
    [rows, useBand],
  )
  if (data.length === 0) return null

  return (
    <details className="rounded-lg border border-slate-800 bg-slate-900/40">
      <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium text-slate-300">
        All values ({data.length})
        {aggregated && <span className="font-normal text-slate-500"> · averaged per {periodLabel.replace(' of', '')}</span>}
      </summary>
      <div className="max-h-72 overflow-y-auto border-t border-slate-800">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-slate-900 text-slate-500">
            <tr>
              <th className="px-3 py-1.5 text-left font-medium">Date</th>
              {useBand ? (
                <>
                  <th className="px-3 py-1.5 text-right font-medium text-emerald-400">High</th>
                  <th className="px-3 py-1.5 text-right font-medium text-rose-400">Low</th>
                </>
              ) : (
                <th className="px-3 py-1.5 text-right font-medium">Value</th>
              )}
            </tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.date} className="border-t border-slate-800/60">
                <td className="px-3 py-1.5 text-slate-400">
                  {periodLabel && <span className="text-slate-600">{periodLabel} </span>}
                  {fullDate(r.date)}
                </td>
                {useBand ? (
                  <>
                    <td className="px-3 py-1.5 text-right font-medium text-slate-200">
                      {r.high != null ? formatMetric(metricKey, r.high) : '—'}
                    </td>
                    <td className="px-3 py-1.5 text-right font-medium text-slate-200">
                      {r.low != null ? formatMetric(metricKey, r.low) : '—'}
                    </td>
                  </>
                ) : (
                  <td className="px-3 py-1.5 text-right font-medium text-slate-200">
                    {formatMetric(metricKey, r.value as number)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg bg-slate-800/60 p-2.5 text-center">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm font-bold" style={{ color: color ?? '#f1f5f9' }}>{value}</p>
    </div>
  )
}

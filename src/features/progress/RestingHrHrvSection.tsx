import { useMemo, useState } from 'react'
import { Area, AreaChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { HeartPulse } from 'lucide-react'
import Card from '../../components/Card'
import SegmentedControl from '../../components/SegmentedControl'
import { useHealthStore } from '../../store/health'
import { formatMetric } from '../../lib/healthMetrics'
import {
  HEALTH_RANGE_OPTIONS,
  bandPosition,
  metricSamples,
  metricSeries,
  typicalRange,
  type HealthRangeKey,
  type MetricSample,
  type TypicalRange,
} from './healthTrends'

/**
 * Recovery = resting HR + HRV. These live on totally different scales (bpm vs ms),
 * so the old chart plotted them on two Y-axes — the single worst charting
 * anti-pattern: the lines cross wherever you happen to scale them, implying
 * relationships that aren't real. Instead each gets its own single-axis mini-chart
 * with its own typical-range band, and a plain-language verdict up top does the
 * "are these two moving the wrong way together?" reading for the user.
 */
export default function RestingHrHrvSection() {
  const days = useHealthStore((s) => s.days)
  const [range, setRange] = useState<HealthRangeKey>('90d')

  const rhrSamples = useMemo(() => metricSamples(days, 'restingHr'), [days])
  const hrvSamples = useMemo(() => metricSamples(days, 'hrv'), [days])

  const rhrBand = useMemo(() => typicalRange(rhrSamples, range), [rhrSamples, range])
  const hrvBand = useMemo(() => typicalRange(hrvSamples, range), [hrvSamples, range])

  const rhrLast = rhrSamples.length ? rhrSamples[rhrSamples.length - 1].value : undefined
  const hrvLast = hrvSamples.length ? hrvSamples[hrvSamples.length - 1].value : undefined

  const verdict = useMemo(() => {
    // Resting HR up + HRV down = classic strain; the reverse = well recovered.
    const rhrPos = rhrLast !== undefined && rhrBand ? bandPosition(rhrLast, rhrBand) : null
    const hrvPos = hrvLast !== undefined && hrvBand ? bandPosition(hrvLast, hrvBand) : null
    if (!rhrPos && !hrvPos) return null
    if (rhrPos === 'above' && hrvPos === 'below')
      return { tone: 'bad', text: 'Under strain — resting HR is up and HRV is down vs your normal. Prioritize rest.' }
    if (rhrPos !== 'above' && hrvPos === 'above')
      return { tone: 'good', text: 'Well recovered — HRV is up and resting HR is steady or low. Good day to push.' }
    if (rhrPos === 'above' || hrvPos === 'below')
      return { tone: 'watch', text: 'Slightly elevated strain — one recovery signal is outside your normal. Ease in.' }
    return { tone: 'good', text: 'Balanced — both recovery signals are within your normal range.' }
  }, [rhrLast, hrvLast, rhrBand, hrvBand])

  const hasData = rhrSamples.length > 0 || hrvSamples.length > 0
  const verdictClass =
    verdict?.tone === 'bad'
      ? 'bg-rose-500/10 text-rose-300'
      : verdict?.tone === 'watch'
        ? 'bg-amber-500/10 text-amber-300'
        : 'bg-emerald-500/10 text-emerald-300'

  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-2">
        <HeartPulse size={16} className="text-red-400" />
        <h2 className="text-sm font-semibold text-slate-200">Recovery — resting HR &amp; HRV</h2>
      </div>

      {!hasData ? (
        <p className="text-xs text-slate-500">
          Import Garmin data to see resting heart rate and HRV recovery trends.
        </p>
      ) : (
        <>
          {verdict && <p className={`rounded-lg px-3 py-2 text-xs font-medium ${verdictClass}`}>{verdict.text}</p>}

          <SegmentedControl
            size="sm"
            options={HEALTH_RANGE_OPTIONS}
            value={range}
            onChange={setRange}
            ariaLabel="Recovery range"
          />

          <RecoveryMetric
            label="Resting heart rate"
            unit="bpm"
            metricKey="restingHr"
            samples={rhrSamples}
            band={rhrBand}
            last={rhrLast}
            range={range}
            color="#f87171"
            gradId="rhrFill"
            lowerIsBetter
          />
          <RecoveryMetric
            label="HRV"
            unit="ms"
            metricKey="hrv"
            samples={hrvSamples}
            band={hrvBand}
            last={hrvLast}
            range={range}
            color="#34d399"
            gradId="hrvFill"
          />
        </>
      )}
    </Card>
  )
}

type RecoveryMetricProps = {
  label: string
  unit: string
  metricKey: string
  samples: MetricSample[]
  band: TypicalRange | null
  last: number | undefined
  range: HealthRangeKey
  color: string
  gradId: string
  /** For the in/out-of-normal chip tone: for resting HR, below-normal is good. */
  lowerIsBetter?: boolean
}

function RecoveryMetric({ label, unit, metricKey, samples, band, last, range, color, gradId, lowerIsBetter }: RecoveryMetricProps) {
  const data = useMemo(() => metricSeries(samples, range), [samples, range])
  const hasPoints = data.some((p) => p.value !== null)

  const pos = last !== undefined && band ? bandPosition(last, band) : null
  // "Good" = below normal for lowerIsBetter metrics (resting HR), above normal otherwise (HRV).
  const posGood = pos === (lowerIsBetter ? 'below' : 'above')
  const posBad = pos === (lowerIsBetter ? 'above' : 'below')
  const chipClass = posGood ? 'text-emerald-300' : posBad ? 'text-rose-300' : 'text-slate-400'
  const posText = pos === 'within' || pos === null ? 'normal' : pos

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between">
        <span className="flex items-center gap-1.5 text-xs font-medium text-slate-300">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
          {label}
        </span>
        {last !== undefined && (
          <span className="text-xs text-slate-400">
            <span className="font-semibold text-slate-100">{formatMetric(metricKey, last)}</span>
            {pos && <span className={`ml-1.5 ${chipClass}`}>{posText}</span>}
          </span>
        )}
      </div>
      <div style={{ height: 110 }}>
        {hasPoints ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="label"
                tick={{ fill: '#64748b', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                minTickGap={28}
              />
              <YAxis
                tick={{ fill: '#64748b', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                domain={['auto', 'auto']}
                width={28}
              />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#cbd5e1' }}
                formatter={(v: number) => [`${formatMetric(metricKey, v)}`, label]}
              />
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
              {band && <ReferenceLine y={band.mid} stroke="#64748b" strokeDasharray="4 3" ifOverflow="extendDomain" />}
              <Area
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2}
                fill={`url(#${gradId})`}
                dot={false}
                connectNulls
                isAnimationActive={false}
                unit={unit}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <p className="pt-6 text-center text-xs text-slate-600">No {label.toLowerCase()} data in this range.</p>
        )}
      </div>
    </div>
  )
}

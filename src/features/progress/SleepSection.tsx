// Sleep history as a chart: one bar per night with the personal typical-range
// band behind it (Apple Health / Oura pattern), a 7-day average trend line, and
// a plain-language headline — how last night compares to your own normal.

import { useMemo, useState } from 'react'
import {
  Bar,
  Cell,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { BedDouble } from 'lucide-react'
import Card from '../../components/Card'
import SegmentedControl from '../../components/SegmentedControl'
import { useHealthStore } from '../../store/health'
import {
  bandPosition,
  metricSamples,
  metricSeries,
  typicalRange,
  withMovingAverage,
  type HealthRangeKey,
} from './healthTrends'

const RANGES: { key: HealthRangeKey; label: string }[] = [
  { key: '30d', label: '30d' },
  { key: '90d', label: '90d' },
  { key: '1y', label: '1y' },
]

function fmtHM(min: number): string {
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return `${h}h ${String(m).padStart(2, '0')}m`
}

export default function SleepSection() {
  const days = useHealthStore((s) => s.days)
  const [range, setRange] = useState<HealthRangeKey>('30d')

  const samples = useMemo(() => metricSamples(days, 'sleepMinutes'), [days])
  const band = useMemo(() => typicalRange(samples, range), [samples, range])
  const data = useMemo(() => withMovingAverage(metricSeries(samples, range), 7), [samples, range])

  if (samples.length === 0) return null

  const last = samples[samples.length - 1].value
  const pos = band ? bandPosition(last, band) : null
  const headline =
    pos === 'within'
      ? 'within your typical range'
      : pos === 'above'
        ? 'above your typical range'
        : pos === 'below'
          ? 'below your typical range'
          : null

  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-2">
        <BedDouble size={16} className="text-sky-400" />
        <h2 className="text-sm font-semibold text-slate-200">Sleep</h2>
      </div>

      <div className="flex items-baseline justify-between">
        <p className="text-2xl font-bold text-slate-100">{fmtHM(last)}</p>
        {band && (
          <p className="text-right text-xs text-slate-400">
            typical {fmtHM(band.low)}–{fmtHM(band.high)}
          </p>
        )}
      </div>
      {headline && (
        <p
          className={`-mt-2 text-xs ${
            pos === 'below' ? 'text-amber-400' : pos === 'above' ? 'text-emerald-400' : 'text-slate-500'
          }`}
        >
          Last night was {headline}.
        </p>
      )}

      <SegmentedControl size="sm" options={RANGES} value={range} onChange={setRange} ariaLabel="Sleep range" />

      <div style={{ height: 160 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
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
              width={30}
              domain={['auto', 'auto']}
              tickFormatter={(v: number) => `${Math.round(v / 60)}h`}
            />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: '#cbd5e1' }}
              formatter={(v: number, name: string) => [fmtHM(v), name]}
            />
            {band && (
              <ReferenceArea y1={band.low} y2={band.high} fill="#64748b" fillOpacity={0.14} stroke="none" ifOverflow="extendDomain" />
            )}
            {band && <ReferenceLine y={band.mid} stroke="#64748b" strokeDasharray="4 3" ifOverflow="extendDomain" />}
            <Bar dataKey="value" name="Sleep" radius={[3, 3, 0, 0]} maxBarSize={10}>
              {data.map((p) => (
                <Cell
                  key={p.date}
                  fill={band && p.value !== null && p.value < band.low ? '#fbbf24' : '#38bdf8'}
                  fillOpacity={0.55}
                />
              ))}
            </Bar>
            <Line type="monotone" dataKey="avg" name="7-day avg" stroke="#38bdf8" strokeWidth={2.5} dot={false} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[11px] text-slate-500">
        Bars = nights (amber = short vs your normal) · bold line = 7-day average · grey band = your typical range.
      </p>
    </Card>
  )
}

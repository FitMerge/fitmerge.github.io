import { useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { HeartPulse } from 'lucide-react'
import Card from '../../components/Card'
import SegmentedControl from '../../components/SegmentedControl'
import { useHealthStore } from '../../store/health'
import { HEALTH_RANGE_OPTIONS, metricSamples, metricSeries, type HealthRangeKey } from './healthTrends'

type RecoveryPoint = { label: string; rhr: number | null; hrv: number | null }

export default function RestingHrHrvSection() {
  const days = useHealthStore((s) => s.days)
  const [range, setRange] = useState<HealthRangeKey>('90d')

  const rhrSamples = useMemo(() => metricSamples(days, 'restingHr'), [days])
  const hrvSamples = useMemo(() => metricSamples(days, 'hrv'), [days])

  const data = useMemo<RecoveryPoint[]>(() => {
    const rhr = metricSeries(rhrSamples, range)
    const hrv = metricSeries(hrvSamples, range)
    return rhr.map((p, i) => ({ label: p.label, rhr: p.value, hrv: hrv[i]?.value ?? null }))
  }, [rhrSamples, hrvSamples, range])

  const hasData = rhrSamples.length > 0 || hrvSamples.length > 0

  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-2">
        <HeartPulse size={16} className="text-red-400" />
        <h2 className="text-sm font-semibold text-slate-200">Recovery — HR vs HRV</h2>
      </div>

      {!hasData ? (
        <p className="text-xs text-slate-500">
          Import Garmin data to see resting heart rate and HRV recovery trends.
        </p>
      ) : (
        <>
          <p className="text-xs text-slate-500">
            When resting HR climbs while HRV drops, your body is under strain — watch for it before an
            illness or overreaching.
          </p>

          <SegmentedControl
            size="sm"
            options={HEALTH_RANGE_OPTIONS}
            value={range}
            onChange={setRange}
            ariaLabel="Recovery range"
          />

          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#1e293b" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={24}
                />
                <YAxis
                  yAxisId="rhr"
                  stroke="#f87171"
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  domain={['auto', 'auto']}
                  width={32}
                />
                <YAxis
                  yAxisId="hrv"
                  orientation="right"
                  stroke="#34d399"
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  domain={['auto', 'auto']}
                  width={32}
                />
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#cbd5e1' }}
                />
                <Line
                  yAxisId="rhr"
                  type="monotone"
                  dataKey="rhr"
                  name="Resting HR"
                  stroke="#f87171"
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
                <Line
                  yAxisId="hrv"
                  type="monotone"
                  dataKey="hrv"
                  name="HRV"
                  stroke="#34d399"
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center justify-center gap-4 text-[11px] text-slate-400">
            <Legend color="#f87171" label="Resting HR (bpm)" />
            <Legend color="#34d399" label="HRV (ms)" />
          </div>
        </>
      )}
    </Card>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  )
}

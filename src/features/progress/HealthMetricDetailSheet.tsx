import { useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { TrendingDown, TrendingUp } from 'lucide-react'
import Sheet from '../../components/Sheet'
import { formatMetric, metricMeta } from '../../lib/healthMetrics'
import {
  HEALTH_RANGE_OPTIONS,
  metricSamples,
  metricSeries,
  metricStats,
  withMovingAverage,
  type HealthRangeKey,
} from './healthTrends'
import type { HealthDay } from '../../types'

type Props = {
  metricKey: string | null
  days: Record<string, HealthDay>
  onClose: () => void
}

export default function HealthMetricDetailSheet({ metricKey, days, onClose }: Props) {
  const [range, setRange] = useState<HealthRangeKey>('90d')

  const samples = useMemo(() => (metricKey ? metricSamples(days, metricKey) : []), [days, metricKey])
  const series = useMemo(() => withMovingAverage(metricSeries(samples, range)), [samples, range])
  const stats = useMemo(() => metricStats(samples, range), [samples, range])

  const meta = metricKey ? metricMeta(metricKey) : null
  const hasPoints = series.some((p) => p.value !== null)
  // Show the smoothing line only for noisy day-by-day ranges; long ranges are
  // already bucketed averages.
  const showAvg = range === '30d' || range === '90d'

  const delta = stats ? stats.last - stats.first : 0
  const improving = meta?.lowerIsBetter ? delta < 0 : delta > 0
  const meaningful = stats ? Math.abs(delta) > Math.abs(stats.avg) * 0.01 : false

  return (
    <Sheet open={metricKey !== null} onClose={onClose} title={meta?.label ?? 'Metric'}>
      {metricKey && (
        <div className="space-y-4">
          <div className="flex gap-2">
            {HEALTH_RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setRange(opt.key)}
                className={`flex-1 rounded-full py-1.5 text-sm font-medium ${
                  range === opt.key ? 'bg-primary-500 text-slate-950 font-semibold' : 'bg-slate-800 text-slate-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {hasPoints && stats ? (
            <>
              <div className="grid grid-cols-3 gap-2">
                <Stat label="Average" value={formatMetric(metricKey, stats.avg)} />
                <Stat label="Low" value={formatMetric(metricKey, stats.min)} />
                <Stat label="High" value={formatMetric(metricKey, stats.max)} />
              </div>

              {meaningful && (
                <div
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium ${
                    improving ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                  }`}
                >
                  {delta > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  {delta > 0 ? '+' : ''}
                  {formatMetric(metricKey, delta)} over this range
                  <span className="text-slate-500">· {improving ? 'improving' : 'worsening'}</span>
                </div>
              )}

              <div style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={series} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
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
                      domain={['auto', 'auto']}
                      width={44}
                      tickFormatter={(v: number) => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : String(Math.round(v)))}
                    />
                    <Tooltip
                      contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ color: '#cbd5e1' }}
                      formatter={(v: number, name) => [
                        formatMetric(metricKey, v),
                        name === 'avg' ? '7-pt avg' : meta?.label ?? '',
                      ]}
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
                      />
                    )}
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#34d399"
                      strokeWidth={2}
                      dot={false}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <p className="text-center text-xs text-slate-500">
                {stats.count} day{stats.count === 1 ? '' : 's'} of data
                {showAvg ? ' · dashed line = 7-day average' : range === '1y' ? ' · weekly average' : ' · monthly average'}
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-800/60 p-2.5 text-center">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm font-bold text-slate-100">{value}</p>
    </div>
  )
}

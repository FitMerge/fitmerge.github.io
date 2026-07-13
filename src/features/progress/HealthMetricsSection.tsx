import { useMemo } from 'react'
import { Activity } from 'lucide-react'
import Card from '../../components/Card'
import { healthDaysDesc, useHealthStore } from '../../store/health'
import { formatMetric, metricMeta, sortedMetricKeys } from '../../lib/healthMetrics'
import { isoToLabel } from '../../lib/date'

export default function HealthMetricsSection() {
  const days = useHealthStore((s) => s.days)
  const desc = useMemo(() => healthDaysDesc(days), [days])

  // Most-recent value (and its date) for every metric that's ever been imported.
  const latest = useMemo(() => {
    const out: Record<string, { value: number; date: string }> = {}
    for (const day of desc) {
      for (const [k, v] of Object.entries(day.metrics)) {
        if (!out[k]) out[k] = { value: v, date: day.date }
      }
    }
    return out
  }, [desc])

  const keys = sortedMetricKeys(Object.keys(latest))

  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-2">
        <Activity size={16} className="text-emerald-400" />
        <h2 className="text-sm font-semibold text-slate-200">Health metrics</h2>
      </div>

      {keys.length === 0 ? (
        <p className="text-xs text-slate-500">
          Import from Garmin or Apple Health (Settings → Connect health data) to see steps, sleep,
          resting heart rate, HRV, Body Battery, VO₂ max and more here.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {keys.map((k) => {
            const { value, date } = latest[k]
            return (
              <div key={k} className="rounded-lg bg-slate-800/60 p-3">
                <p className="truncate text-xs text-slate-400">{metricMeta(k).label}</p>
                <p className="text-lg font-bold text-slate-100">{formatMetric(k, value)}</p>
                <p className="text-[10px] text-slate-500">{isoToLabel(date)}</p>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

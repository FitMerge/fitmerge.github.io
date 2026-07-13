import { useMemo, useState } from 'react'
import { Activity, ChevronRight, TrendingDown, TrendingUp } from 'lucide-react'
import Card from '../../components/Card'
import { healthDaysDesc, useHealthStore } from '../../store/health'
import { formatMetric, metricMeta, sortedMetricKeys } from '../../lib/healthMetrics'
import { isoToLabel } from '../../lib/date'
import HealthMetricDetailSheet from './HealthMetricDetailSheet'

export default function HealthMetricsSection() {
  const days = useHealthStore((s) => s.days)
  const [selected, setSelected] = useState<string | null>(null)
  const desc = useMemo(() => healthDaysDesc(days), [days])

  // Latest value per metric, plus the value ~30 days before that for a trend arrow.
  const summary = useMemo(() => {
    const out: Record<string, { value: number; date: string; prev?: number }> = {}
    for (const day of desc) {
      for (const [k, v] of Object.entries(day.metrics)) {
        if (!out[k]) out[k] = { value: v, date: day.date }
      }
    }
    for (const k of Object.keys(out)) {
      const cutoff = out[k].date
      // desc is newest-first; find the first sample at least ~30 days older.
      const target = new Date(cutoff)
      target.setDate(target.getDate() - 30)
      const targetIso = target.toISOString().slice(0, 10)
      const prior = desc.find((d) => d.date <= targetIso && typeof d.metrics[k] === 'number')
      if (prior) out[k].prev = prior.metrics[k]
    }
    return out
  }, [desc])

  const keys = sortedMetricKeys(Object.keys(summary))

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
        <>
          <p className="text-xs text-slate-500">Tap a metric to see it over time.</p>
          <div className="grid grid-cols-2 gap-2">
            {keys.map((k) => {
              const { value, date, prev } = summary[k]
              const delta = prev !== undefined ? value - prev : 0
              const showTrend = prev !== undefined && Math.abs(delta) > Math.abs(value) * 0.005
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setSelected(k)}
                  className="rounded-lg bg-slate-800/60 p-3 text-left active:bg-slate-800"
                >
                  <div className="flex items-center justify-between">
                    <p className="truncate text-xs text-slate-400">{metricMeta(k).label}</p>
                    <ChevronRight size={14} className="shrink-0 text-slate-600" />
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <p className="text-lg font-bold text-slate-100">{formatMetric(k, value)}</p>
                    {showTrend && (
                      <span className="flex items-center text-[10px] font-medium text-slate-400">
                        {delta > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500">{isoToLabel(date)}</p>
                </button>
              )
            })}
          </div>
        </>
      )}

      <HealthMetricDetailSheet metricKey={selected} days={days} onClose={() => setSelected(null)} />
    </Card>
  )
}

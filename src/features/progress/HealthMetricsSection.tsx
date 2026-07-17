import { useMemo, useState } from 'react'
import { Activity, ChevronRight, TrendingDown, TrendingUp } from 'lucide-react'
import Card from '../../components/Card'
import Sparkline from '../../components/Sparkline'
import { healthDaysDesc, useHealthStore } from '../../store/health'
import { formatMetric, groupedMetricKeys, metricMeta, type MetricGroup } from '../../lib/healthMetrics'
import { isoToLabel } from '../../lib/date'
import HealthMetricDetailSheet from './HealthMetricDetailSheet'

type MetricSummary = {
  value: number
  date: string
  prev?: number
  /** Oldest→newest recent values, for the tile sparkline. */
  spark: number[]
}

type HealthMetricsSectionProps = {
  /** Restrict to these metric groups (so each Health tab owns its domains). */
  only?: MetricGroup[]
  /** Card heading; defaults to "Health metrics". */
  title?: string
}

export default function HealthMetricsSection({ only, title = 'Health metrics' }: HealthMetricsSectionProps = {}) {
  const days = useHealthStore((s) => s.days)
  const [selected, setSelected] = useState<string | null>(null)
  const desc = useMemo(() => healthDaysDesc(days), [days])

  // One pass over the (newest-first) days builds, per metric: the latest value,
  // a ~30-day-prior value for the trend arrow, and the recent series for the
  // sparkline.
  const summary = useMemo(() => {
    const out: Record<string, MetricSummary> = {}
    const sparkDesc: Record<string, number[]> = {}
    for (const day of desc) {
      for (const [k, v] of Object.entries(day.metrics)) {
        if (typeof v !== 'number' || !Number.isFinite(v)) continue
        if (!out[k]) out[k] = { value: v, date: day.date, spark: [] }
        const s = sparkDesc[k] ?? (sparkDesc[k] = [])
        if (s.length < 30) s.push(v)
      }
    }
    for (const k of Object.keys(out)) {
      out[k].spark = (sparkDesc[k] ?? []).slice().reverse() // oldest→newest
      const target = new Date(out[k].date)
      target.setDate(target.getDate() - 30)
      const targetIso = target.toISOString().slice(0, 10)
      const prior = desc.find((d) => d.date <= targetIso && typeof d.metrics[k] === 'number')
      if (prior) out[k].prev = prior.metrics[k]
    }
    return out
  }, [desc])

  const groups = useMemo(() => {
    const all = groupedMetricKeys(Object.keys(summary))
    return only ? all.filter((g) => only.includes(g.group)) : all
  }, [summary, only])

  return (
    <Card className="space-y-4">
      <div className="flex items-center gap-2">
        <Activity size={16} className="text-emerald-400" />
        <h2 className="text-sm font-semibold text-slate-200">{title}</h2>
      </div>

      {groups.length === 0 ? (
        <p className="text-xs text-slate-500">
          Import from Garmin or Apple Health (Settings → Connect health data) to see steps, sleep,
          resting heart rate, HRV, Body Battery, training readiness, VO₂ max, race predictors and more
          here — each as a chartable trend.
        </p>
      ) : (
        <>
          <p className="text-xs text-slate-500">Tap any metric for the full history, ranges and averages.</p>
          {groups.map((g) => (
            <div key={g.group} className="space-y-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{g.label}</h3>
              <div className="grid grid-cols-2 gap-2">
                {g.keys.map((k) => {
                  const { value, date, prev, spark } = summary[k]
                  const meta = metricMeta(k)
                  const delta = prev !== undefined ? value - prev : 0
                  const showTrend = prev !== undefined && Math.abs(delta) > Math.abs(value) * 0.005
                  const improving = meta.lowerIsBetter ? delta < 0 : delta > 0
                  const trendColor = !showTrend ? '' : improving ? 'text-emerald-400' : 'text-rose-400'
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setSelected(k)}
                      className="rounded-lg bg-slate-800/60 p-3 text-left active:bg-slate-800"
                    >
                      <div className="flex items-center justify-between">
                        <p className="truncate text-xs text-slate-400">{meta.label}</p>
                        <ChevronRight size={14} className="shrink-0 text-slate-600" />
                      </div>
                      <div className="flex items-baseline gap-1.5">
                        <p className="text-lg font-bold text-slate-100">{formatMetric(k, value)}</p>
                        {showTrend && (
                          <span className={`flex items-center text-[10px] font-medium ${trendColor}`}>
                            {delta > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 flex items-end justify-between">
                        <Sparkline
                          values={spark}
                          stroke={showTrend ? (improving ? '#34d399' : '#f43f5e') : '#64748b'}
                        />
                        <span className="ml-1 shrink-0 text-[9px] text-slate-600">{isoToLabel(date)}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </>
      )}

      <HealthMetricDetailSheet metricKey={selected} days={days} onClose={() => setSelected(null)} />
    </Card>
  )
}

import { useMemo, useState } from 'react'
import { Activity, ChevronRight, TrendingDown, TrendingUp } from 'lucide-react'
import Card from '../../components/Card'
import Sparkline from '../../components/Sparkline'
import { healthDaysDesc, useHealthStore } from '../../store/health'
import {
  formatMetric,
  groupedMetricEntries,
  metricMeta,
  metricValue,
  type MetricEntry,
  type MetricGroup,
  type ResolvedFamily,
} from '../../lib/healthMetrics'
import { isoToLabel } from '../../lib/date'
import { typicalRangeOf } from './healthTrends'
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

/** Colours for a composition bar's segments, in declaration order. */
const SEGMENT_COLORS = ['#38bdf8', '#a78bfa', '#34d399', '#f59e0b', '#f43f5e']

export default function HealthMetricsSection({ only, title = 'Health metrics' }: HealthMetricsSectionProps = {}) {
  const days = useHealthStore((s) => s.days)
  // Which metric the detail sheet is charting, plus the sibling metrics it can
  // switch between when the tile was a family.
  const [selected, setSelected] = useState<{ key: string; siblings: string[] } | null>(null)
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
    const all = groupedMetricEntries(Object.keys(summary))
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
                {g.entries.map((entry) => (
                  <Tile
                    key={entry.key}
                    entry={entry}
                    summary={summary}
                    onOpen={(key, siblings) => setSelected({ key, siblings })}
                  />
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      <HealthMetricDetailSheet
        metricKey={selected?.key ?? null}
        siblings={selected?.siblings ?? []}
        days={days}
        onClose={() => setSelected(null)}
      />
    </Card>
  )
}

function Tile({
  entry,
  summary,
  onOpen,
}: {
  entry: MetricEntry
  summary: Record<string, MetricSummary>
  onOpen: (key: string, siblings: string[]) => void
}) {
  const headlineKey = entry.kind === 'family' ? entry.resolved.headline : entry.key
  const stat = summary[headlineKey]
  if (!stat) return null

  const { value, date, prev, spark } = stat
  // A family's own label ("Body Battery") beats the headline metric's, which is
  // often qualified in a way that only made sense when it was one tile of five.
  const label = entry.kind === 'family' ? entry.resolved.family.label : metricMeta(entry.key).label
  const meta = metricMeta(headlineKey)

  const delta = prev !== undefined ? value - prev : 0
  const showTrend = prev !== undefined && Math.abs(delta) > Math.abs(value) * 0.005
  const improving = meta.lowerIsBetter ? delta < 0 : delta > 0
  const trendColor = !showTrend ? '' : improving ? 'text-emerald-400' : 'text-rose-400'
  const sparkStroke = showTrend ? (improving ? '#34d399' : '#f43f5e') : '#64748b'
  // Shade the metric's own typical range behind the tile spark so the latest
  // point reads as in / out of normal at a glance — but not for slow metrics,
  // where the value barely varies and a "range" is just noise.
  const tband = meta.slow ? null : typicalRangeOf(spark)

  const siblings = entry.kind === 'family' ? entry.resolved.members : [headlineKey]

  return (
    <button
      type="button"
      onClick={() => onOpen(headlineKey, siblings)}
      className="rounded-lg bg-slate-800/60 p-3 text-left active:bg-slate-800"
    >
      <div className="flex items-center justify-between">
        <p className="truncate text-xs text-slate-400">{label}</p>
        <ChevronRight size={14} className="shrink-0 text-slate-600" />
      </div>
      <div className="flex items-baseline gap-1.5">
        <p className="text-lg font-bold text-slate-100">{formatMetric(headlineKey, value)}</p>
        {showTrend && (
          <span className={`flex items-center text-[10px] font-medium ${trendColor}`}>
            {delta > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
          </span>
        )}
      </div>

      {entry.kind === 'family' && <FamilyDetail resolved={entry.resolved} summary={summary} />}

      <div className="mt-1.5 flex items-end justify-between">
        <Sparkline
          values={spark}
          stroke={sparkStroke}
          band={tband ? [tband.low, tband.high] : undefined}
          baseline={tband?.mid}
          fill
        />
        <span className="ml-1 shrink-0 text-[9px] text-slate-600">{isoToLabel(date)}</span>
      </div>
    </button>
  )
}

/**
 * The one line that replaces a family's extra tiles: the spread for a range, a
 * stacked bar for a composition, a count for a list.
 */
function FamilyDetail({
  resolved,
  summary,
}: {
  resolved: ResolvedFamily
  summary: Record<string, MetricSummary>
}) {
  const { family, low, high, components, members } = resolved

  if (family.kind === 'range') {
    const lowV = low ? summary[low]?.value : undefined
    const highV = high ? summary[high]?.value : undefined
    if (lowV === undefined && highV === undefined) return null
    // Bare numbers: the unit is already on the headline directly above.
    return (
      <p className="text-[10px] text-slate-500 tabular-nums">
        {lowV !== undefined && highV !== undefined
          ? `${metricValue(low as string, lowV)}–${metricValue(high as string, highV)}`
          : lowV !== undefined
            ? `low ${metricValue(low as string, lowV)}`
            : `peak ${metricValue(high as string, highV as number)}`}
      </p>
    )
  }

  if (family.kind === 'composition') {
    const parts = components
      .map((k) => ({ key: k, value: summary[k]?.value ?? 0 }))
      .filter((p) => p.value > 0)
    const total = parts.reduce((s, p) => s + p.value, 0)
    if (total <= 0) return null
    return (
      <div className="mt-1 space-y-1">
        <div className="flex h-1.5 overflow-hidden rounded-full bg-slate-900">
          {parts.map((p, i) => (
            <span
              key={p.key}
              style={{ width: `${(p.value / total) * 100}%`, background: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }}
              title={`${metricMeta(p.key).label} ${formatMetric(p.key, p.value)}`}
            />
          ))}
        </div>
        <p className="truncate text-[9px] text-slate-500">
          {parts.map((p) => `${shortLabel(p.key)} ${metricValue(p.key, p.value)}`).join(' · ')}
        </p>
      </div>
    )
  }

  // 'list' — say how much more is behind the tap rather than showing nothing.
  const others = members.length - 1
  if (others <= 0) return null
  return <p className="text-[10px] text-slate-500">+{others} more</p>
}

/** "Deep sleep" → "Deep": the family label already carries the context. */
function shortLabel(key: string): string {
  return metricMeta(key)
    .label.replace(/\s*sleep\s*/i, ' ')
    .replace(/\s*intensity\s*/i, ' ')
    .replace(/\s*time\s*/i, ' ')
    .trim()
}

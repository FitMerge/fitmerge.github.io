// Every lift at a glance, for the metric currently selected.
//
// This is the navigator, not the destination: it exists so you can spot which
// lifts are moving and which are stalling, then tap one to put it in the chart
// above. It deliberately reports the SAME metric as that chart — a list showing
// one number and a chart showing another is how you end up mistrusting both.

import { useMemo, useState } from 'react'
import { ChevronRight, Minus, TrendingDown, TrendingUp } from 'lucide-react'
import Card from '../../components/Card'
import { useWorkoutsStore } from '../../store/workouts'
import { useSettingsStore } from '../../store/settings'
import { getExerciseById } from '../../data/exercises'
import { weightUnitLabel } from '../workouts/utils'
import { monthDayLabel } from './utils'
import {
  exerciseSummaries,
  liftMetricMeta,
  type ExerciseSummary,
  type LiftMetric,
  type LiftRangeKey,
} from './lifting'

const COLLAPSED = 6
/** Below this, a change is noise rather than a move. */
const MEANINGFUL_PCT = 0.02

type Props = {
  metric: LiftMetric
  range: LiftRangeKey
  activeExerciseId: string | null
  onSelectExercise: (id: string) => void
}

export default function StrengthProgressSection({
  metric,
  range,
  activeExerciseId,
  onSelectExercise,
}: Props) {
  const sessions = useWorkoutsStore((s) => s.sessions)
  const units = useSettingsStore((s) => s.units)
  const unitLabel = weightUnitLabel(units)
  const [expanded, setExpanded] = useState(false)

  const meta = liftMetricMeta(metric)
  const summaries = useMemo(
    () => exerciseSummaries(sessions, metric, range),
    [sessions, metric, range],
  )
  const shown = expanded ? summaries : summaries.slice(0, COLLAPSED)

  return (
    <Card>
      <h2 className="mb-1 text-sm font-semibold text-slate-200">All lifts</h2>
      <p className="mb-3 text-[11px] text-slate-500">
        {meta.label} per session, most recently trained first. Tap one to chart it above.
      </p>

      {summaries.length === 0 ? (
        <p className="py-2 text-sm text-slate-500">No completed strength sets in this range yet.</p>
      ) : (
        <div className="space-y-1">
          {shown.map((s) => (
            <TrendRow
              key={s.exerciseId}
              summary={s}
              unitLabel={unitLabel}
              isVolume={meta.isVolume}
              active={s.exerciseId === activeExerciseId}
              onOpen={() => onSelectExercise(s.exerciseId)}
            />
          ))}

          {summaries.length > COLLAPSED && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="w-full pt-1.5 text-center text-[11px] font-medium text-slate-400"
            >
              {expanded ? 'Show less' : `Show all ${summaries.length}`}
            </button>
          )}
        </div>
      )}
    </Card>
  )
}

function TrendRow({
  summary,
  unitLabel,
  isVolume,
  active,
  onOpen,
}: {
  summary: ExerciseSummary
  unitLabel: string
  isVolume: boolean
  active: boolean
  onOpen: () => void
}) {
  const exercise = getExerciseById(summary.exerciseId)
  const delta = summary.last - summary.first
  // One session is a reading, not a trend — say so instead of showing "+0".
  const single = summary.sessions < 2
  const meaningful = !single && Math.abs(delta) > summary.first * MEANINGFUL_PCT
  const up = delta > 0
  const show = (v: number) => (isVolume ? Math.round(v).toLocaleString() : String(Math.round(v * 10) / 10))

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left ${
        active ? 'bg-emerald-500/10' : 'active:bg-slate-800'
      }`}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-slate-100">
          {exercise?.name ?? summary.exerciseId}
        </span>
        <span className="block text-[11px] text-slate-500">
          {summary.sessions} session{summary.sessions === 1 ? '' : 's'} · last{' '}
          {monthDayLabel(summary.lastDate)}
        </span>
      </span>

      <Sparkline values={summary.values} up={up} flat={!meaningful} />

      <span className="w-[5rem] shrink-0 text-right">
        <span className="block text-sm font-semibold text-slate-100 tabular-nums">
          {show(summary.last)} {unitLabel}
        </span>
        <span
          className={`flex items-center justify-end gap-0.5 text-[10px] tabular-nums ${
            single || !meaningful ? 'text-slate-500' : up ? 'text-emerald-400' : 'text-amber-400'
          }`}
        >
          {single ? (
            'first log'
          ) : meaningful ? (
            <>
              {up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
              {up ? '+' : ''}
              {show(delta)}
            </>
          ) : (
            <>
              <Minus size={10} />
              holding
            </>
          )}
        </span>
      </span>
      <ChevronRight size={14} className="shrink-0 text-slate-600" />
    </button>
  )
}

/**
 * A bare polyline — no axes, no interaction. At this size a recharts chart would
 * cost a wrapper, a tooltip and a resize observer per row to draw twenty pixels
 * of line; the real chart is one tap away.
 */
function Sparkline({ values, up, flat }: { values: number[]; up: boolean; flat: boolean }) {
  const w = 52
  const h = 22
  if (values.length < 2) return <span style={{ width: w }} className="shrink-0" />

  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * (w - 2) + 1
      const y = h - 2 - ((v - min) / span) * (h - 4)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  const stroke = flat ? '#64748b' : up ? '#34d399' : '#fbbf24'
  return (
    <svg width={w} height={h} className="shrink-0 overflow-visible" aria-hidden>
      <polyline points={points} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  )
}

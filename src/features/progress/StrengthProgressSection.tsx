// "Am I getting stronger?" — per exercise, over time.
//
// Volume (total weight moved) answers a different question: how much work you
// did. It rises when you add sets and falls on a deload, so as a progress measure
// it mostly tracks how big your session was. What a lifter wants to know is
// whether the bar is going up, and that is per exercise — squats can be climbing
// while presses stall, and a single combined number hides exactly that.
//
// Ordered by most recently trained, so yesterday's work is at the top rather than
// whichever lift happens to be heaviest.

import { useMemo, useState } from 'react'
import { ChevronRight, Minus, TrendingDown, TrendingUp } from 'lucide-react'
import Card from '../../components/Card'
import ExerciseProgressSheet from '../workouts/ExerciseProgressSheet'
import { useWorkoutsStore } from '../../store/workouts'
import { useSettingsStore } from '../../store/settings'
import { getExerciseById } from '../../data/exercises'
import { weightUnitLabel } from '../workouts/utils'
import { exerciseTrends, monthDayLabel, type ExerciseTrend, type RangeKey } from './utils'

const COLLAPSED = 6
/** Below this, a change is rounding on an estimate rather than a real move. */
const MEANINGFUL_PCT = 0.02

export default function StrengthProgressSection({ range }: { range: RangeKey }) {
  const sessions = useWorkoutsStore((s) => s.sessions)
  const units = useSettingsStore((s) => s.units)
  const unitLabel = weightUnitLabel(units)
  const [expanded, setExpanded] = useState(false)
  const [openExerciseId, setOpenExerciseId] = useState<string | null>(null)

  const trends = useMemo(() => exerciseTrends(sessions, range), [sessions, range])
  const shown = expanded ? trends : trends.slice(0, COLLAPSED)

  return (
    <Card>
      <h2 className="mb-1 text-sm font-semibold text-slate-200">Strength by exercise</h2>
      <p className="mb-3 text-[11px] text-slate-500">
        Your best set of each session, as an estimated 1RM. Tap an exercise for the full history.
      </p>

      {trends.length === 0 ? (
        <p className="py-2 text-sm text-slate-500">
          No completed strength sets in this range yet.
        </p>
      ) : (
        <div className="space-y-1">
          {shown.map((t) => (
            <TrendRow
              key={t.exerciseId}
              trend={t}
              unitLabel={unitLabel}
              onOpen={() => setOpenExerciseId(t.exerciseId)}
            />
          ))}

          {trends.length > COLLAPSED && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="w-full pt-1.5 text-center text-[11px] font-medium text-slate-400"
            >
              {expanded ? 'Show less' : `Show all ${trends.length}`}
            </button>
          )}
        </div>
      )}

      <ExerciseProgressSheet exerciseId={openExerciseId} onClose={() => setOpenExerciseId(null)} />
    </Card>
  )
}

function TrendRow({
  trend,
  unitLabel,
  onOpen,
}: {
  trend: ExerciseTrend
  unitLabel: string
  onOpen: () => void
}) {
  const exercise = getExerciseById(trend.exerciseId)
  const delta = trend.last - trend.first
  // One session is a reading, not a trend — say so instead of showing "+0".
  const single = trend.points.length < 2
  const meaningful = !single && Math.abs(delta) > trend.first * MEANINGFUL_PCT
  const up = delta > 0

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left active:bg-slate-800"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-slate-100">
          {exercise?.name ?? trend.exerciseId}
        </span>
        <span className="block text-[11px] text-slate-500">
          {trend.points.length} session{trend.points.length === 1 ? '' : 's'} · last{' '}
          {monthDayLabel(trend.lastDate)}
        </span>
      </span>

      <Sparkline values={trend.points.map((p) => p.est1RM)} up={up} flat={!meaningful} />

      <span className="w-[4.5rem] shrink-0 text-right">
        <span className="block text-sm font-semibold text-slate-100 tabular-nums">
          {trend.last.toFixed(0)} {unitLabel}
        </span>
        <span
          className={`flex items-center justify-end gap-0.5 text-[10px] tabular-nums ${
            single ? 'text-slate-500' : meaningful ? (up ? 'text-emerald-400' : 'text-amber-400') : 'text-slate-500'
          }`}
        >
          {single ? (
            'first log'
          ) : meaningful ? (
            <>
              {up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
              {up ? '+' : ''}
              {delta.toFixed(1)}
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

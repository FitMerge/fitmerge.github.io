// The lifting progress page: one exercise, one metric, its whole history.
//
// What was here before could not answer "am I lifting more than I was" for any
// particular lift. There was a tonnage bar chart for everything combined and a
// list of sparklines, and the only real chart was a bottom sheet three taps away
// inside the exercise library. This is the chart, on the page, with the exercise
// and the metric both switchable without leaving it.

import { useEffect, useMemo, useRef, useState } from 'react'
import { Area, AreaChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from 'recharts'
import { ChevronDown } from 'lucide-react'
import Card from '../../components/Card'
import ScrubChart from '../../components/ScrubChart'
import SegmentedControl from '../../components/SegmentedControl'
import Sheet from '../../components/Sheet'
import { useWorkoutsStore } from '../../store/workouts'
import { useSettingsStore } from '../../store/settings'
import { getExerciseById } from '../../data/exercises'
import { weightUnitLabel } from '../workouts/utils'
import { monthDayLabel } from './utils'
import {
  LIFT_RANGE_OPTIONS,
  exerciseSeries,
  exerciseSummaries,
  liftMetricMeta,
  type LiftMetric,
  type LiftRangeKey,
} from './lifting'

type Props = {
  metric: LiftMetric
  exerciseId: string | null
  onSelectExercise: (id: string) => void
}

/** Volumes get thousands separators; weights get at most one decimal. */
function fmt(value: number, isVolume: boolean): string {
  return isVolume ? Math.round(value).toLocaleString() : String(Math.round(value * 10) / 10)
}

export default function ExerciseProgressSection({ metric, exerciseId, onSelectExercise }: Props) {
  const sessions = useWorkoutsStore((s) => s.sessions)
  const units = useSettingsStore((s) => s.units)
  const unitLabel = weightUnitLabel(units)
  const [range, setRange] = useState<LiftRangeKey>('6m')
  const [pickerOpen, setPickerOpen] = useState(false)
  const anchor = useRef<HTMLDivElement>(null)

  // Selecting an exercise from a list further down the page has to bring the
  // chart into view, or the tap looks like it did nothing. Only on a real change
  // between two exercises — not when the initial default is being pinned below,
  // which would scroll the page on arrival.
  const prevExerciseId = useRef(exerciseId)
  useEffect(() => {
    const changed = prevExerciseId.current !== null && prevExerciseId.current !== exerciseId
    prevExerciseId.current = exerciseId
    if (changed) anchor.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [exerciseId])

  const meta = liftMetricMeta(metric)
  // Everything ever trained, so the picker can reach a lift you have not touched
  // inside the current chart range.
  const allExercises = useMemo(() => exerciseSummaries(sessions, metric, 'all'), [sessions, metric])
  const active = exerciseId ?? allExercises[0]?.exerciseId ?? null

  // Pin the default the first time one exists. Without this the "first exercise"
  // is recomputed per metric, and since ties break on the metric's own value,
  // changing metric silently swapped which lift you were looking at.
  useEffect(() => {
    if (exerciseId === null && active !== null) onSelectExercise(active)
  }, [exerciseId, active, onSelectExercise])

  const points = useMemo(
    () => (active ? exerciseSeries(sessions, active, metric, range) : []),
    [sessions, active, metric, range],
  )

  const best = points.reduce((m, p) => Math.max(m, p.value), 0)
  const latest = points.length > 0 ? points[points.length - 1] : null
  const first = points.length > 0 ? points[0].value : 0
  const delta = latest ? latest.value - first : 0
  const meaningful = points.length >= 2 && Math.abs(delta) > first * 0.01
  const exercise = active ? getExerciseById(active) : undefined

  return (
    <Card className="space-y-3">
      <div ref={anchor} className="scroll-mt-4">
        <h2 className="text-sm font-semibold text-slate-200">Exercise progress</h2>
        <p className="text-[11px] text-slate-500">{meta.help}</p>
      </div>

      {allExercises.length === 0 ? (
        <p className="py-2 text-sm text-slate-500">
          No completed strength sets yet. Log a workout and this fills in.
        </p>
      ) : (
        <>
          {/* A button rather than a row of chips: with thirty exercises the chip
              row becomes its own scrolling problem, and the point of this page is
              that picking a lift is one obvious tap. */}
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="flex w-full items-center justify-between gap-2 rounded-xl bg-slate-800 px-3 py-2.5 text-left active:bg-slate-700"
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-slate-100">
                {exercise?.name ?? active}
              </span>
              <span className="block text-[11px] text-slate-500">
                {points.length} session{points.length === 1 ? '' : 's'} in range · tap to change
              </span>
            </span>
            <ChevronDown size={16} className="shrink-0 text-slate-400" />
          </button>

          <SegmentedControl
            size="sm"
            options={LIFT_RANGE_OPTIONS}
            value={range}
            onChange={setRange}
            ariaLabel="Exercise history range"
          />

          {points.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">
              No sessions with this exercise in this range.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2 text-center">
                <Stat label="Latest" value={`${fmt(latest?.value ?? 0, meta.isVolume)} ${unitLabel}`} />
                <Stat label="Best" value={`${fmt(best, meta.isVolume)} ${unitLabel}`} />
                <Stat
                  label="Change"
                  value={
                    points.length < 2
                      ? '—'
                      : `${delta > 0 ? '+' : ''}${fmt(delta, meta.isVolume)} ${unitLabel}`
                  }
                  tone={!meaningful ? 'flat' : delta > 0 ? 'good' : 'bad'}
                />
              </div>

              <ScrubChart
                data={points}
                height={210}
                label={(p) => p.label}
                values={(p) => [
                  {
                    key: 'v',
                    value: `${fmt(p.value, meta.isVolume)} ${unitLabel}`,
                  },
                  {
                    key: 'top',
                    name: `${p.sets} set${p.sets === 1 ? '' : 's'} · top`,
                    value: `${p.topWeight}×${p.topReps}`,
                    color: '#64748b',
                  },
                ]}
              >
                <AreaChart data={points} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="liftFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#34d399" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#1e293b" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    minTickGap={28}
                  />
                  <YAxis
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={48}
                    domain={['auto', 'auto']}
                    tickFormatter={(v: number) =>
                      Math.abs(v) >= 10000 ? `${Math.round(v / 1000)}k` : String(Math.round(v))
                    }
                  />
                  {/* Your best in this range, so a session reads against your ceiling. */}
                  {best > 0 && (
                    <ReferenceLine
                      y={best}
                      stroke="#fbbf24"
                      strokeDasharray="4 3"
                      strokeOpacity={0.7}
                      label={{ value: 'best', position: 'insideTopRight', fill: '#fbbf24', fontSize: 10 }}
                    />
                  )}
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#34d399"
                    strokeWidth={2}
                    fill="url(#liftFill)"
                    dot={{ r: 2.5, fill: '#34d399', strokeWidth: 0 }}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ScrubChart>

              {/* Session by session, newest first — the numbers behind the line. */}
              <div className="space-y-1 border-t border-slate-800 pt-2">
                <p className="text-[11px] font-medium text-slate-400">Every session</p>
                {[...points].reverse().map((p) => (
                  <div
                    key={p.date}
                    className="flex items-center gap-2 rounded-lg bg-slate-800/40 px-2.5 py-1.5"
                  >
                    <span className="w-16 shrink-0 text-[11px] text-slate-400">{p.label}</span>
                    <span className="min-w-0 flex-1 truncate text-[11px] text-slate-500">
                      {p.sets} set{p.sets === 1 ? '' : 's'} · top {p.topWeight} {unitLabel} × {p.topReps}
                    </span>
                    <span className="shrink-0 text-[11px] font-semibold text-slate-100 tabular-nums">
                      {fmt(p.value, meta.isVolume)} {unitLabel}
                      {p.value === best && <span className="ml-1 text-amber-400">★</span>}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      <Sheet open={pickerOpen} onClose={() => setPickerOpen(false)} title="Choose exercise">
        <div className="space-y-1">
          {allExercises.map((s) => {
            const ex = getExerciseById(s.exerciseId)
            return (
              <button
                key={s.exerciseId}
                type="button"
                onClick={() => {
                  onSelectExercise(s.exerciseId)
                  setPickerOpen(false)
                }}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left ${
                  s.exerciseId === active ? 'bg-emerald-500/15' : 'active:bg-slate-800'
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-slate-100">
                    {ex?.name ?? s.exerciseId}
                  </span>
                  <span className="block text-[11px] text-slate-500">
                    {s.sessions} session{s.sessions === 1 ? '' : 's'} · last {monthDayLabel(s.lastDate)}
                  </span>
                </span>
                <span className="shrink-0 text-xs font-semibold text-slate-200 tabular-nums">
                  {fmt(s.best, meta.isVolume)} {unitLabel}
                </span>
              </button>
            )
          })}
        </div>
      </Sheet>
    </Card>
  )
}

function Stat({
  label,
  value,
  tone = 'flat',
}: {
  label: string
  value: string
  tone?: 'good' | 'bad' | 'flat'
}) {
  const color = tone === 'good' ? 'text-emerald-400' : tone === 'bad' ? 'text-amber-400' : 'text-slate-100'
  return (
    <div className="rounded-lg bg-slate-800/60 p-2.5">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-0.5 text-sm font-bold tabular-nums ${color}`}>{value}</p>
    </div>
  )
}

import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from 'recharts'
import { ChevronRight } from 'lucide-react'
import Card from '../../components/Card'
import ScrubChart from '../../components/ScrubChart'
import SessionDetail from '../workouts/SessionDetail'
import { useWorkoutsStore } from '../../store/workouts'
import { useSettingsStore } from '../../store/settings'
import { formatDurationMin, sessionDurationMs, totalSetsDone, totalVolume, weightUnitLabel } from '../workouts/utils'
import { isCardioSession } from '../workouts/cardio'
import SegmentedControl from '../../components/SegmentedControl'
import {
  RANGE_OPTIONS,
  finishedSessionsInRange,
  monthDayLabel,
  totalSetsInRange,
  volumeSeries,
  type RangeKey,
  type VolumePoint,
} from './utils'
import type { WorkoutSession } from '../../types'

export default function VolumeSection() {
  // Its own range: this card is the only thing that uses one, and a picker at
  // page level read as though it governed the exercise chart too.
  const [range, setRange] = useState<RangeKey>('30d')
  const sessions = useWorkoutsStore((s) => s.sessions)
  const units = useSettingsStore((s) => s.units)
  const unitLabel = weightUnitLabel(units)
  // The period whose workouts are listed under the chart. Tapping a bar sets it.
  const [picked, setPicked] = useState<VolumePoint | null>(null)
  const [openSession, setOpenSession] = useState<WorkoutSession | null>(null)

  // Lifting only — cardio sessions (imported runs/rides/etc.) live on the Cardio tab.
  const sessionsInRange = useMemo(
    () => finishedSessionsInRange(sessions, range).filter((s) => !isCardioSession(s)),
    [sessions, range],
  )
  const chartData = useMemo(() => volumeSeries(range, sessions), [range, sessions])
  const totalSets = useMemo(() => totalSetsInRange(sessionsInRange), [sessionsInRange])

  // Workouts inside the tapped bar — the answer to "which sessions made that?"
  const pickedSessions = useMemo(() => {
    if (!picked) return []
    return sessions
      .filter((s) => s.finishedAt !== undefined && !isCardioSession(s))
      .filter((s) => s.date >= picked.start && s.date <= picked.end)
      .sort((a, b) => (a.date < b.date ? 1 : -1))
  }, [sessions, picked])

  const nonZero = chartData.filter((p) => p.volume > 0)
  const avgVolume = nonZero.length ? nonZero.reduce((s, p) => s + p.volume, 0) / nonZero.length : 0
  // Raw pound/kilo totals get unreadable fast ("38000") — show "38k" instead.
  const kFmt = (v: number): string => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${Math.round(v)}`)
  const periodNoun = range === '7d' ? 'day' : 'week'

  return (
    <Card>
      <h2 className="mb-1 text-sm font-semibold text-slate-200">Training volume</h2>
      {/* Volume is a real metric but an easy one to misread as a score, so the
          card says what it sums and what it cannot tell you. */}
      <p className="mb-3 text-[11px] text-slate-500">
        Total weight moved per {periodNoun} — every working set&apos;s weight × reps, added up, in{' '}
        {unitLabel}. It measures how much work you did, not how strong you are: it climbs when you
        add sets and drops on a deload. For a single lift over time, use the chart above.
      </p>

      <SegmentedControl
        size="sm"
        options={RANGE_OPTIONS}
        value={range}
        onChange={setRange}
        ariaLabel="Volume range"
      />

      <div className="mb-3 mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-slate-800/60 p-3">
          <p className="text-xs text-slate-500">Sessions</p>
          <p className="text-xl font-bold text-slate-100">{sessionsInRange.length}</p>
        </div>
        <div className="rounded-xl bg-slate-800/60 p-3">
          <p className="text-xs text-slate-500">Sets done</p>
          <p className="text-xl font-bold text-slate-100">{totalSets}</p>
        </div>
      </div>

      {chartData.every((p) => p.volume === 0) ? (
        <div className="py-2">
          <p className="text-sm text-slate-500">No finished workouts in this range yet.</p>
          <p className="mt-1 text-[11px] text-slate-600">
            Strength volume comes from workouts you log in the app — imported Garmin cardio doesn’t
            count here.
          </p>
        </div>
      ) : (
        <>
          <ScrubChart
            data={chartData}
            height={180}
            label={(p) => p.label}
            values={(p) =>
              p.volume > 0
                ? [{ key: 'v', value: `${Math.round(p.volume).toLocaleString()} ${unitLabel}` }]
                : []
            }
            empty="no lifting"
            onPick={(p) => setPicked(p.volume > 0 ? p : null)}
          >
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#1e293b" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fill: '#64748b', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={36}
                tickFormatter={kFmt}
              />
              {avgVolume > 0 && (
                <ReferenceLine
                  y={avgVolume}
                  stroke="#64748b"
                  strokeDasharray="4 3"
                  label={{ value: 'avg', position: 'insideTopRight', fill: '#64748b', fontSize: 10 }}
                />
              )}
              <Bar dataKey="volume" fill="#818cf8" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ScrubChart>

          {picked === null ? (
            <p className="mt-2 text-center text-[11px] text-slate-500">
              Tap a bar to see the workouts in that {periodNoun}.
            </p>
          ) : (
            <div className="mt-2 space-y-1 border-t border-slate-800 pt-2">
              <p className="text-[11px] font-medium text-slate-400">
                {range === '7d'
                  ? monthDayLabel(picked.start)
                  : `${monthDayLabel(picked.start)} – ${monthDayLabel(picked.end)}`}
                <span className="text-slate-600">
                  {' · '}
                  {pickedSessions.length} workout{pickedSessions.length === 1 ? '' : 's'}
                </span>
              </p>
              {pickedSessions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setOpenSession(s)}
                  className="flex w-full items-center gap-2 rounded-lg bg-slate-800/40 px-2.5 py-1.5 text-left active:bg-slate-800"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-slate-200">{s.name}</span>
                    <span className="block text-[10px] text-slate-500">
                      {monthDayLabel(s.date)} · {totalSetsDone(s)} sets
                      {/* formatDurationMin takes MILLISECONDS despite the name. */}
                      {sessionDurationMs(s) > 0 && ` · ${formatDurationMin(sessionDurationMs(s))}`}
                    </span>
                  </span>
                  <span className="shrink-0 text-[11px] font-semibold text-slate-100 tabular-nums">
                    {Math.round(totalVolume(s)).toLocaleString()} {unitLabel}
                  </span>
                  <ChevronRight size={13} className="shrink-0 text-slate-600" />
                </button>
              ))}
            </div>
          )}
        </>
      )}

      <SessionDetail
        session={openSession}
        onClose={() => setOpenSession(null)}
        onRepeated={() => setOpenSession(null)}
      />
    </Card>
  )
}

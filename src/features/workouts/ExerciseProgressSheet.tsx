import { useMemo } from 'react'
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import ScrubChart from '../../components/ScrubChart'
import Sheet from '../../components/Sheet'
import { useWorkoutsStore } from '../../store/workouts'
import { useSettingsStore } from '../../store/settings'
import { getExerciseById } from '../../data/exercises'
import { epley1RM, monthDayLabel } from '../progress/utils'
import { lifetimeTonnage, weightUnitLabel } from './utils'
import { TONNAGE_MILESTONES } from './prDetect'
import type { WorkoutSession } from '../../types'

type ExerciseProgressSheetProps = {
  exerciseId: string | null
  onClose: () => void
}

type ProgressPoint = { date: string; label: string; est1RM: number; weight: number; reps: number }

/** Best est-1RM done set per finished session containing the exercise, oldest to newest. */
function progressSeries(sessions: WorkoutSession[], exerciseId: string): ProgressPoint[] {
  const points: ProgressPoint[] = []
  for (const session of sessions) {
    if (!session.finishedAt) continue
    const entry = session.entries.find((e) => e.exerciseId === exerciseId)
    if (!entry) continue

    let best: { est1RM: number; weight: number; reps: number } | null = null
    for (const set of entry.sets) {
      if (!set.done || set.reps <= 0 || set.weight <= 0) continue
      const est1RM = epley1RM(set.weight, set.reps)
      if (!best || est1RM > best.est1RM) best = { est1RM, weight: set.weight, reps: set.reps }
    }
    if (best) points.push({ date: session.date, label: monthDayLabel(session.date), ...best })
  }
  return points.sort((a, b) => (a.date < b.date ? -1 : 1))
}

export default function ExerciseProgressSheet({ exerciseId, onClose }: ExerciseProgressSheetProps) {
  const sessions = useWorkoutsStore((s) => s.sessions)
  const units = useSettingsStore((s) => s.units)
  const unitLabel = weightUnitLabel(units)
  const exercise = exerciseId ? getExerciseById(exerciseId) : undefined

  const points = useMemo(
    () => (exerciseId ? progressSeries(sessions, exerciseId) : []),
    [sessions, exerciseId],
  )

  const best = useMemo(
    () => points.reduce<ProgressPoint | null>((acc, p) => (!acc || p.est1RM > acc.est1RM ? p : acc), null),
    [points],
  )

  const tonnage = useMemo(() => (exerciseId ? lifetimeTonnage(sessions, exerciseId) : 0), [sessions, exerciseId])
  const nextMilestone = TONNAGE_MILESTONES.find((m) => m > tonnage) ?? null
  const milestonePct = nextMilestone ? Math.min(1, tonnage / nextMilestone) : 1

  return (
    <Sheet open={exerciseId !== null} onClose={onClose} title={exercise?.name ?? ''}>
      {exerciseId && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-slate-800/60 py-3">
              <p className="text-lg font-bold text-slate-100">{best ? best.est1RM.toFixed(1) : '—'}</p>
              <p className="text-xs text-slate-500">Best est. 1RM ({unitLabel})</p>
            </div>
            <div className="rounded-xl bg-slate-800/60 py-3">
              <p className="text-lg font-bold text-slate-100">
                {best ? `${best.weight} × ${best.reps}` : '—'}
              </p>
              <p className="text-xs text-slate-500">Best set ({unitLabel})</p>
            </div>
            <div className="rounded-xl bg-slate-800/60 py-3">
              <p className="text-lg font-bold text-slate-100">{points.length}</p>
              <p className="text-xs text-slate-500">Sessions</p>
            </div>
          </div>

          {tonnage > 0 && (
            <div className="rounded-xl bg-gradient-to-br from-amber-500/10 to-slate-800/60 px-3 py-3">
              <div className="flex items-baseline justify-between">
                <p className="text-xs text-slate-400">All-time volume lifted</p>
                <p className="text-lg font-bold text-amber-200">
                  {Math.round(tonnage).toLocaleString()} <span className="text-xs font-normal text-slate-400">{unitLabel}</span>
                </p>
              </div>
              {nextMilestone && (
                <>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-700">
                    <div className="h-full rounded-full bg-amber-400" style={{ width: `${milestonePct * 100}%` }} />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {Math.round(nextMilestone - tonnage).toLocaleString()} {unitLabel} to {nextMilestone.toLocaleString()}
                  </p>
                </>
              )}
            </div>
          )}

          {points.length >= 2 ? (
            <ScrubChart
              data={points}
              height={180}
              label={(p) => p.label}
              values={(p) => [{ key: 'e1rm', name: 'est. 1RM', value: `${p.est1RM.toFixed(1)} ${unitLabel}` }]}
            >
                <LineChart data={points} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    domain={['auto', 'auto']}
                    width={44}
                    tickFormatter={(value: number) => value.toFixed(0)}
                  />
                  <Line
                    type="monotone"
                    dataKey="est1RM"
                    stroke="#34d399"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#34d399' }}
                  />
                </LineChart>
            </ScrubChart>
          ) : (
            <p className="text-sm text-slate-500 py-2 text-center">Log more sessions to see a trend.</p>
          )}
        </div>
      )}
    </Sheet>
  )
}

import { useEffect, useState } from 'react'
import Sheet from '../../components/Sheet'
import Button from '../../components/Button'
import { useWorkoutsStore } from '../../store/workouts'
import { useSettingsStore } from '../../store/settings'
import { getExerciseById } from '../../data/exercises'
import { isoToLabel, todayISO } from '../../lib/date'
import { formatDurationMin, sessionDurationMs, totalSetsDone, totalVolume, weightUnitLabel } from './utils'
import { activityStats } from './cardio'
import type { WorkoutSession } from '../../types'

type SessionDetailProps = {
  session: WorkoutSession | null
  onClose: () => void
  /** Called after a repeat session has been started, so the parent can navigate to it. */
  onRepeated: () => void
}

export default function SessionDetail({ session, onClose, onRepeated }: SessionDetailProps) {
  const startSession = useWorkoutsStore((s) => s.startSession)
  const removeSession = useWorkoutsStore((s) => s.removeSession)
  const units = useSettingsStore((s) => s.units)
  const unitLabel = weightUnitLabel(units)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    setConfirmDelete(false)
  }, [session?.id])

  function repeat() {
    if (!session) return
    startSession({
      routineId: session.routineId,
      name: session.name,
      date: todayISO(),
      startedAt: Date.now(),
      entries: session.entries.map((e) => ({
        exerciseId: e.exerciseId,
        sets: e.sets.map((s) => ({ reps: s.reps, weight: s.weight, done: false })),
      })),
    })
    onRepeated()
  }

  function confirmedDelete() {
    if (!session) return
    removeSession(session.id)
    onClose()
  }

  const durationMs = session ? sessionDurationMs(session) : 0
  // A session with any logged sets is a strength workout; everything else (runs,
  // rides, yoga, imported cardio, manual activities) gets the activity layout.
  const isStrength = session ? session.entries.some((e) => e.sets.length > 0) : false
  const activity = session && !isStrength ? activityStats(session, units) : null
  // Repeating only makes sense for a set-based workout; a run has nothing to seed.
  const canRepeat = isStrength

  return (
    <Sheet open={session !== null} onClose={onClose} title={session?.name ?? ''}>
      {session && (
        <div className="space-y-4">
          <p className="text-sm text-slate-400 flex items-center gap-1.5">
            {isoToLabel(session.date)} · {formatDurationMin(durationMs)}
            {session.imported && (
              <span className="shrink-0 rounded-full bg-slate-700 px-1.5 py-0.5 text-[10px] font-medium text-slate-300">
                Imported
              </span>
            )}
          </p>

          {activity ? (
            <>
              {activity.tiles.length > 0 && (
                <div
                  className="grid gap-2 text-center"
                  style={{ gridTemplateColumns: `repeat(${activity.tiles.length}, minmax(0, 1fr))` }}
                >
                  {activity.tiles.map(([label, value]) => (
                    <div key={label} className="rounded-xl bg-slate-800/60 py-3">
                      <p className="text-lg font-bold text-slate-100 tabular-nums">{value}</p>
                      <p className="text-xs text-slate-500">{label}</p>
                    </div>
                  ))}
                </div>
              )}

              {activity.rows.length > 0 ? (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-slate-800/40 p-3">
                  {activity.rows.map(([label, value]) => (
                    <div key={label} className="flex items-baseline justify-between gap-2">
                      <dt className="truncate text-xs text-slate-500">{label}</dt>
                      <dd className="shrink-0 text-sm font-medium text-slate-200 tabular-nums">{value}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                activity.tiles.length <= 1 && (
                  <p className="text-sm text-slate-500">
                    Only the basics were recorded for this one. A Garmin or Fitbit import adds heart rate,
                    pace, ascent and training effect.
                  </p>
                )
              )}
            </>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-slate-800/60 py-3">
                  <p className="text-lg font-bold text-slate-100 tabular-nums">{formatDurationMin(durationMs)}</p>
                  <p className="text-xs text-slate-500">Duration</p>
                </div>
                <div className="rounded-xl bg-slate-800/60 py-3">
                  <p className="text-lg font-bold text-slate-100">{totalSetsDone(session)}</p>
                  <p className="text-xs text-slate-500">Sets done</p>
                </div>
                <div className="rounded-xl bg-slate-800/60 py-3">
                  <p className="text-lg font-bold text-slate-100">{Math.round(totalVolume(session)).toLocaleString()}</p>
                  <p className="text-xs text-slate-500">Volume ({unitLabel})</p>
                </div>
              </div>

              <div className="space-y-3">
              {session.entries.map((entry) => {
                const exercise = getExerciseById(entry.exerciseId)
                const vol = entry.sets
                  .filter((s) => s.done && s.type !== 'warmup')
                  .reduce((sum, s) => sum + s.weight * s.reps, 0)
                return (
                  <div key={entry.exerciseId}>
                    <div className="mb-1 flex items-baseline justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-100">
                        {exercise?.name ?? 'Unknown exercise'}
                      </p>
                      {vol > 0 && (
                        <span className="shrink-0 text-xs tabular-nums text-slate-500">
                          {Math.round(vol).toLocaleString()} {unitLabel}
                        </span>
                      )}
                    </div>
                    {entry.note && <p className="mb-1 text-xs italic text-slate-500">{entry.note}</p>}
                    <div className="space-y-1">
                      {entry.sets.map((set, idx) => {
                        const tag = set.type === 'warmup' ? 'W' : set.type === 'drop' ? 'D' : `${idx + 1}`
                        const tagCls =
                          set.type === 'warmup'
                            ? 'text-amber-400'
                            : set.type === 'drop'
                              ? 'text-purple-400'
                              : 'text-slate-500'
                        return (
                          <p
                            key={idx}
                            className={`flex items-center gap-2 text-sm tabular-nums ${set.done ? 'text-slate-300' : 'text-slate-600'}`}
                          >
                            <span className={`w-4 text-xs font-semibold ${tagCls}`}>{tag}</span>
                            {set.weight} {unitLabel} × {set.reps} {set.done ? '✓' : '✗'}
                          </p>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
              </div>
            </>
          )}

          {canRepeat && (
            <Button variant="primary" full onClick={repeat}>
              Repeat workout
            </Button>
          )}

          {confirmDelete ? (
            <div className="space-y-2">
              <p className="text-sm text-slate-400 text-center">Delete this session? This can&apos;t be undone.</p>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="ghost" full onClick={() => setConfirmDelete(false)}>
                  Cancel
                </Button>
                <Button variant="danger" full onClick={confirmedDelete}>
                  Confirm delete
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="ghost" full onClick={() => setConfirmDelete(true)} className="text-red-400">
              Delete session
            </Button>
          )}
        </div>
      )}
    </Sheet>
  )
}

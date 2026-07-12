import { useEffect, useState } from 'react'
import Sheet from '../../components/Sheet'
import Button from '../../components/Button'
import { useWorkoutsStore } from '../../store/workouts'
import { useSettingsStore } from '../../store/settings'
import { getExerciseById } from '../../data/exercises'
import { isoToLabel, todayISO } from '../../lib/date'
import { formatDurationMin, sessionDurationMs, totalSetsDone, totalVolume, weightUnitLabel } from './utils'
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
  const canRepeat = session ? !(session.imported && session.entries.length === 0) : false

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

          {session.entries.length === 0 && session.imported ? (
            <p className="text-sm text-slate-500">
              No set-by-set data — imported from Health Connect.
              {session.kcal !== undefined ? ` ${Math.round(session.kcal)} kcal.` : ''}
            </p>
          ) : (
            <div className="space-y-3">
              {session.entries.map((entry) => {
                const exercise = getExerciseById(entry.exerciseId)
                return (
                  <div key={entry.exerciseId}>
                    <p className="text-sm font-semibold text-slate-100 mb-1">
                      {exercise?.name ?? 'Unknown exercise'}
                    </p>
                    <div className="space-y-1">
                      {entry.sets.map((set, idx) => (
                        <p
                          key={idx}
                          className={`text-sm tabular-nums ${set.done ? 'text-slate-300' : 'text-slate-600'}`}
                        >
                          {set.weight} {unitLabel} × {set.reps} {set.done ? '✓' : '✗'}
                        </p>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
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

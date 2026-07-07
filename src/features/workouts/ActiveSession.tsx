import { useEffect, useMemo, useState } from 'react'
import Card from '../../components/Card'
import Button from '../../components/Button'
import Sheet from '../../components/Sheet'
import ExercisePicker from './ExercisePicker'
import SetRow from './SetRow'
import RestTimerBar from './RestTimerBar'
import { useWorkoutsStore } from '../../store/workouts'
import { useSettingsStore } from '../../store/settings'
import { getExerciseById } from '../../data/exercises'
import {
  DEFAULT_REST_SEC,
  formatElapsed,
  lastWeightForExercise,
  totalSetsDone,
  totalVolume,
  weightUnitLabel,
} from './utils'
import type { Exercise, SetLog, WorkoutSessionEntry } from '../../types'

type ActiveSessionProps = {
  sessionId: string
  onExit: () => void
}

type RestTimerState = { total: number; secondsLeft: number }

export default function ActiveSession({ sessionId, onExit }: ActiveSessionProps) {
  const sessions = useWorkoutsStore((s) => s.sessions)
  const routines = useWorkoutsStore((s) => s.routines)
  const updateSession = useWorkoutsStore((s) => s.updateSession)
  const removeSession = useWorkoutsStore((s) => s.removeSession)
  const setActiveSessionId = useWorkoutsStore((s) => s.setActiveSessionId)
  const units = useSettingsStore((s) => s.units)

  const session = sessions.find((s) => s.id === sessionId)
  const routine = useMemo(
    () => (session?.routineId ? routines.find((r) => r.id === session.routineId) : undefined),
    [routines, session?.routineId],
  )

  const [now, setNow] = useState(() => Date.now())
  const [restTimer, setRestTimer] = useState<RestTimerState | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [finishOpen, setFinishOpen] = useState(false)

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!restTimer || restTimer.secondsLeft <= 0) return
    const t = setTimeout(() => {
      setRestTimer((r) => (r ? { ...r, secondsLeft: r.secondsLeft - 1 } : r))
    }, 1000)
    return () => clearTimeout(t)
  }, [restTimer])

  if (!session) {
    return (
      <div className="p-4 space-y-4">
        <p className="text-sm text-slate-400">This workout session is no longer available.</p>
        <Button variant="ghost" full onClick={onExit}>
          Back to workouts
        </Button>
      </div>
    )
  }

  function restSecFor(exerciseId: string): number {
    const item = routine?.items.find((it) => it.exerciseId === exerciseId)
    return item?.restSec ?? DEFAULT_REST_SEC
  }

  function patchEntries(next: WorkoutSessionEntry[]) {
    updateSession(session!.id, { entries: next })
  }

  function patchSet(exerciseId: string, setIdx: number, patch: Partial<SetLog>) {
    patchEntries(
      session!.entries.map((e) =>
        e.exerciseId === exerciseId
          ? { ...e, sets: e.sets.map((s, i) => (i === setIdx ? { ...s, ...patch } : s)) }
          : e,
      ),
    )
  }

  function addSet(exerciseId: string) {
    const entry = session!.entries.find((e) => e.exerciseId === exerciseId)
    const last = entry?.sets[entry.sets.length - 1]
    const routineItem = routine?.items.find((it) => it.exerciseId === exerciseId)
    const newSet: SetLog = {
      reps: last?.reps ?? routineItem?.targetReps ?? 10,
      weight: last?.weight ?? lastWeightForExercise(sessions, exerciseId),
      done: false,
    }
    patchEntries(
      session!.entries.map((e) => (e.exerciseId === exerciseId ? { ...e, sets: [...e.sets, newSet] } : e)),
    )
  }

  function addExerciseEntry(exercise: Exercise) {
    if (session!.entries.some((e) => e.exerciseId === exercise.id)) return
    const weight = lastWeightForExercise(sessions, exercise.id)
    const newEntry: WorkoutSessionEntry = {
      exerciseId: exercise.id,
      sets: Array.from({ length: 3 }, () => ({ reps: 10, weight, done: false })),
    }
    patchEntries([...session!.entries, newEntry])
  }

  function handleCheckedOn(exerciseId: string) {
    const total = restSecFor(exerciseId)
    setRestTimer({ total, secondsLeft: total })
  }

  function finishSession() {
    updateSession(session!.id, { finishedAt: Date.now() })
    setActiveSessionId(undefined)
    onExit()
  }

  function discardSession() {
    removeSession(session!.id)
    setActiveSessionId(undefined)
    onExit()
  }

  const elapsedMs = now - session.startedAt
  const setsDone = totalSetsDone(session)
  const volume = totalVolume(session)

  return (
    <div className="p-4 pb-24 space-y-4">
      <header className="flex items-center justify-between">
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-slate-100 truncate">{session.name}</h1>
          <p className="text-sm text-slate-400 tabular-nums">{formatElapsed(elapsedMs)}</p>
        </div>
        <Button variant="primary" onClick={() => setFinishOpen(true)}>
          Finish
        </Button>
      </header>

      <div className="space-y-3">
        {session.entries.length === 0 ? (
          <p className="text-sm text-slate-500">No exercises yet. Add one to get started.</p>
        ) : (
          session.entries.map((entry) => {
            const exercise = getExerciseById(entry.exerciseId)
            return (
              <Card key={entry.exerciseId}>
                <h3 className="text-sm font-semibold text-slate-100 mb-1">
                  {exercise?.name ?? 'Unknown exercise'}
                </h3>
                <div>
                  {entry.sets.map((set, idx) => (
                    <SetRow
                      key={idx}
                      index={idx}
                      set={set}
                      units={units}
                      onChange={(patch) => patchSet(entry.exerciseId, idx, patch)}
                      onCheckedOn={() => handleCheckedOn(entry.exerciseId)}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => addSet(entry.exerciseId)}
                  className="w-full mt-2 rounded-lg bg-slate-800 active:bg-slate-700 py-2 text-xs font-medium text-slate-300"
                >
                  + Add set
                </button>
              </Card>
            )
          })
        )}

        {!session.routineId && (
          <Button variant="ghost" full onClick={() => setPickerOpen(true)}>
            + Add exercise
          </Button>
        )}
      </div>

      {restTimer && (
        <RestTimerBar
          secondsLeft={restTimer.secondsLeft}
          totalSeconds={restTimer.total}
          onAddTime={() => setRestTimer((r) => (r ? { total: r.total + 15, secondsLeft: r.secondsLeft + 15 } : r))}
          onSkip={() => setRestTimer(null)}
        />
      )}

      <ExercisePicker open={pickerOpen} onClose={() => setPickerOpen(false)} onPick={addExerciseEntry} />

      <Sheet open={finishOpen} onClose={() => setFinishOpen(false)} title="Finish workout?">
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-slate-800/60 py-3">
              <p className="text-lg font-bold text-slate-100 tabular-nums">{formatElapsed(elapsedMs)}</p>
              <p className="text-xs text-slate-500">Duration</p>
            </div>
            <div className="rounded-xl bg-slate-800/60 py-3">
              <p className="text-lg font-bold text-slate-100">{setsDone}</p>
              <p className="text-xs text-slate-500">Sets done</p>
            </div>
            <div className="rounded-xl bg-slate-800/60 py-3">
              <p className="text-lg font-bold text-slate-100">{Math.round(volume)}</p>
              <p className="text-xs text-slate-500">Volume ({weightUnitLabel(units)})</p>
            </div>
          </div>

          <Button variant="primary" full onClick={finishSession}>
            Confirm finish
          </Button>
          <Button variant="ghost" full onClick={() => setFinishOpen(false)}>
            Keep going
          </Button>
          <Button variant="danger" full onClick={discardSession}>
            Discard workout
          </Button>
        </div>
      </Sheet>
    </div>
  )
}

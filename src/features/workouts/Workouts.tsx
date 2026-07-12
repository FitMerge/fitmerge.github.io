import { useState } from 'react'
import { Dumbbell, History, Plus } from 'lucide-react'
import Card from '../../components/Card'
import Button from '../../components/Button'
import EmptyState from '../../components/EmptyState'
import RoutineCard from './RoutineCard'
import RoutinePreviewSheet from './RoutinePreviewSheet'
import ExerciseLibrary from './ExerciseLibrary'
import RoutineEditor from './RoutineEditor'
import ActiveSession from './ActiveSession'
import SessionHistory from './SessionHistory'
import { useWorkoutsStore } from '../../store/workouts'
import { todayISO } from '../../lib/date'
import { lastWeightForExercise } from './utils'
import type { Routine, WorkoutSessionEntry } from '../../types'

type ViewState =
  | { kind: 'home' }
  | { kind: 'library' }
  | { kind: 'edit'; routineId?: string }
  | { kind: 'session' }
  | { kind: 'history' }

export default function Workouts() {
  const [view, setView] = useState<ViewState>({ kind: 'home' })
  const [previewRoutine, setPreviewRoutine] = useState<Routine | null>(null)

  const routines = useWorkoutsStore((s) => s.routines)
  const sessions = useWorkoutsStore((s) => s.sessions)
  const addRoutine = useWorkoutsStore((s) => s.addRoutine)
  const removeRoutine = useWorkoutsStore((s) => s.removeRoutine)
  const startSession = useWorkoutsStore((s) => s.startSession)
  const activeSessionId = useWorkoutsStore((s) => s.activeSessionId)

  const activeSession = activeSessionId ? sessions.find((s) => s.id === activeSessionId) : undefined
  const finishedCount = sessions.filter((s) => s.finishedAt !== undefined).length

  function startFromRoutine(routine: Routine) {
    const entries: WorkoutSessionEntry[] = routine.items.map((item) => ({
      exerciseId: item.exerciseId,
      sets: Array.from({ length: item.targetSets }, () => ({
        reps: item.targetReps,
        weight: lastWeightForExercise(sessions, item.exerciseId),
        done: false,
      })),
    }))
    startSession({
      routineId: routine.id,
      name: routine.name,
      date: todayISO(),
      startedAt: Date.now(),
      entries,
    })
    setPreviewRoutine(null)
    setView({ kind: 'session' })
  }

  function quickStart() {
    startSession({
      name: 'Quick workout',
      date: todayISO(),
      startedAt: Date.now(),
      entries: [],
    })
    setView({ kind: 'session' })
  }

  function duplicateRoutine(routine: Routine) {
    addRoutine({
      name: `${routine.name} (copy)`,
      notes: routine.notes,
      items: routine.items,
      scheduleDays: routine.scheduleDays,
    })
  }

  if (view.kind === 'library') {
    return <ExerciseLibrary onBack={() => setView({ kind: 'home' })} />
  }

  if (view.kind === 'edit') {
    return (
      <RoutineEditor
        routineId={view.routineId}
        onDone={() => setView({ kind: 'home' })}
        onCancel={() => setView({ kind: 'home' })}
      />
    )
  }

  if (view.kind === 'session') {
    return <ActiveSession sessionId={activeSessionId ?? ''} onExit={() => setView({ kind: 'home' })} />
  }

  if (view.kind === 'history') {
    return (
      <SessionHistory
        onBack={() => setView({ kind: 'home' })}
        onRepeated={() => setView({ kind: 'session' })}
      />
    )
  }

  return (
    <div className="p-4 pb-24 space-y-4">
      <header>
        <h1 className="text-xl font-bold text-slate-100">Workouts</h1>
        <p className="text-sm text-slate-400">Plan routines and log training sessions.</p>
      </header>

      {activeSession && !activeSession.finishedAt && (
        <Card className="border-primary-500/60" onClick={() => setView({ kind: 'session' })}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-primary-400">Resume workout</p>
              <p className="text-xs text-slate-400 truncate">{activeSession.name}</p>
            </div>
            <Button variant="primary" onClick={() => setView({ kind: 'session' })}>
              Resume
            </Button>
          </div>
        </Card>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-200">My routines</h2>

        {routines.length === 0 ? (
          <EmptyState
            icon={Dumbbell}
            title="Build your first routine"
            subtitle="Create a routine to plan and track your workouts."
            action={
              <Button variant="primary" full onClick={() => setView({ kind: 'edit' })}>
                + New routine
              </Button>
            }
          />
        ) : (
          <div className="space-y-2">
            {routines.map((routine) => (
              <RoutineCard
                key={routine.id}
                routine={routine}
                onOpen={() => setPreviewRoutine(routine)}
                onEdit={() => setView({ kind: 'edit', routineId: routine.id })}
                onDuplicate={() => duplicateRoutine(routine)}
                onDelete={() => removeRoutine(routine.id)}
              />
            ))}
          </div>
        )}
      </section>

      {routines.length > 0 && (
        <Button variant="primary" full onClick={() => setView({ kind: 'edit' })}>
          <span className="flex items-center justify-center gap-1.5">
            <Plus size={16} />
            New routine
          </span>
        </Button>
      )}

      <Button variant="ghost" full onClick={quickStart}>
        Quick start
      </Button>

      <Card className="active:bg-slate-800/60 flex items-center gap-3" onClick={() => setView({ kind: 'library' })}>
        <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-primary-400 shrink-0">
          <Dumbbell size={18} />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-100">Exercise library</p>
          <p className="text-xs text-slate-500">Browse exercises by muscle group</p>
        </div>
      </Card>

      <Card className="active:bg-slate-800/60 flex items-center gap-3" onClick={() => setView({ kind: 'history' })}>
        <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-primary-400 shrink-0">
          <History size={18} />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-100">History</p>
          <p className="text-xs text-slate-500">
            {finishedCount} finished workout{finishedCount === 1 ? '' : 's'}
          </p>
        </div>
      </Card>

      <RoutinePreviewSheet
        routine={previewRoutine}
        onClose={() => setPreviewRoutine(null)}
        onStart={startFromRoutine}
        onEdit={(routine) => {
          setPreviewRoutine(null)
          setView({ kind: 'edit', routineId: routine.id })
        }}
      />
    </div>
  )
}

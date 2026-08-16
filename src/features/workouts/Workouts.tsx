import { lazy, Suspense, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { BarChart3, CalendarRange, ChevronRight, Dumbbell, History, LayoutList, Loader2, Plus } from 'lucide-react'
import Card from '../../components/Card'
import Button from '../../components/Button'
import EmptyState from '../../components/EmptyState'
import SegmentedControl from '../../components/SegmentedControl'
import RoutineCard from './RoutineCard'
import RoutinePreviewSheet from './RoutinePreviewSheet'
import LogActivitySheet from './LogActivitySheet'
import ExerciseLibrary from './ExerciseLibrary'
import RoutineEditor from './RoutineEditor'
import ActiveSession from './ActiveSession'
import SessionHistory from './SessionHistory'
import RecentWorkoutsCard from './RecentWorkoutsCard'
import CardioSummaryCard from './CardioSummaryCard'
import ProgramBuilder from './ProgramBuilder'
import ProgramLibrary from './ProgramLibrary'
import ProgramDetail from './ProgramDetail'
import WorkoutStats from './WorkoutStats'
import ExerciseCard from '../nutrition/ExerciseCard'
import { useWorkoutsStore } from '../../store/workouts'
import { todayISO, weekdayIndex } from '../../lib/date'
import { lastWeightForExercise } from './utils'
import type { Routine, WorkoutSessionEntry } from '../../types'

// Progress charts pull in Recharts; lazy so the Train chunk stays light until the
// Progress sub-tab is opened.
const TrainingProgress = lazy(() => import('./TrainingProgress'))

type ViewState =
  | { kind: 'home' }
  | { kind: 'library' }
  | { kind: 'edit'; routineId?: string }
  | { kind: 'session' }
  | { kind: 'history' }
  | { kind: 'stats' }
  | { kind: 'program'; programId: string }
  | { kind: 'programEdit'; programId?: string }
  | { kind: 'programs' }

type TrainTab = 'train' | 'progress'

const TAB_OPTIONS = [
  { key: 'train' as const, label: 'Train' },
  { key: 'progress' as const, label: 'Progress' },
]

export default function Workouts() {
  const [tab, setTab] = useState<TrainTab>('train')
  // Land back IN the workout when one is running. This state is local, so leaving
  // the tab used to drop you on the workouts home with a Resume card — an extra
  // tap to get back to a session you never left, and no clock in the meantime.
  // Lazy init only, so exiting the session later still goes home as it should.
  const [view, setView] = useState<ViewState>(() =>
    useWorkoutsStore.getState().activeSessionId ? { kind: 'session' } : { kind: 'home' },
  )
  const [previewRoutine, setPreviewRoutine] = useState<Routine | null>(null)
  const [logActivityOpen, setLogActivityOpen] = useState(false)
  // Which discipline the Progress view opens on. "See all" on the cardio card
  // jumps straight to cardio instead of the lifting-first default.
  const [progressDiscipline, setProgressDiscipline] = useState<'lifting' | 'cardio'>('lifting')

  function openCardioDashboard() {
    setProgressDiscipline('cardio')
    setTab('progress')
  }

  const location = useLocation()
  const navigate = useNavigate()

  const routines = useWorkoutsStore((s) => s.routines)
  const sessions = useWorkoutsStore((s) => s.sessions)
  const programs = useWorkoutsStore((s) => s.programs)
  const addRoutine = useWorkoutsStore((s) => s.addRoutine)
  const removeRoutine = useWorkoutsStore((s) => s.removeRoutine)
  const startSession = useWorkoutsStore((s) => s.startSession)
  const activeSessionId = useWorkoutsStore((s) => s.activeSessionId)

  const activeSession = activeSessionId ? sessions.find((s) => s.id === activeSessionId) : undefined
  const finishedCount = sessions.filter((s) => s.finishedAt !== undefined).length
  const todaysRoutine = routines.find((r) => r.scheduleDays?.includes(weekdayIndex(todayISO())))

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

  useEffect(() => {
    const state = location.state as
      | {
          startRoutineId?: string
          previewRoutineId?: string
          coachSession?: { name: string; items: { exerciseId: string; sets: number; reps: number }[] }
        }
      | null
    if (!state?.startRoutineId && !state?.previewRoutineId && !state?.coachSession) return

    // Open a routine to look at (from Home) without starting it.
    if (state.previewRoutineId) {
      const routine = routines.find((r) => r.id === state.previewRoutineId)
      if (routine) setPreviewRoutine(routine)
    } else if (!activeSessionId) {
      if (state.startRoutineId) {
        const routine = routines.find((r) => r.id === state.startRoutineId)
        if (routine) startFromRoutine(routine)
      } else if (state.coachSession) {
        // Ad-hoc session the AI coach recommended — build entries, seeding each
        // set's weight from the last time this exercise was trained.
        const entries: WorkoutSessionEntry[] = state.coachSession.items.map((item) => ({
          exerciseId: item.exerciseId,
          sets: Array.from({ length: Math.max(1, item.sets) }, () => ({
            reps: item.reps,
            weight: lastWeightForExercise(sessions, item.exerciseId),
            done: false,
          })),
        }))
        startSession({ name: state.coachSession.name, date: todayISO(), startedAt: Date.now(), entries })
        setView({ kind: 'session' })
      }
    }
    navigate('.', { replace: true, state: null })
    // Only re-run when the incoming navigation state changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state])

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

  if (view.kind === 'stats') {
    return <WorkoutStats onBack={() => setView({ kind: 'home' })} />
  }

  if (view.kind === 'programs') {
    return <ProgramLibrary onBack={() => setView({ kind: 'home' })} onStarted={() => setView({ kind: 'home' })} />
  }

  if (view.kind === 'programEdit') {
    return <ProgramBuilder programId={view.programId} onDone={() => setView({ kind: 'home' })} />
  }

  if (view.kind === 'program') {
    return (
      <ProgramDetail
        programId={view.programId}
        onStartSession={() => setView({ kind: 'session' })}
        onEdit={() => setView({ kind: 'programEdit', programId: view.programId })}
        onDone={() => setView({ kind: 'home' })}
      />
    )
  }

  if (tab === 'progress') {
    return (
      <div className="p-4 pb-24 space-y-4">
        <header>
          <h1 className="text-xl font-bold text-slate-100">Train</h1>
          <p className="text-sm text-slate-400">Strength per lift, volume, records and cardio.</p>
        </header>
        <SegmentedControl options={TAB_OPTIONS} value={tab} onChange={setTab} ariaLabel="Training view" />
        <Suspense
          fallback={
            <div className="flex justify-center py-16">
              <Loader2 size={24} className="animate-spin text-emerald-400" />
            </div>
          }
        >
          <TrainingProgress initialDiscipline={progressDiscipline} />
        </Suspense>
      </div>
    )
  }

  return (
    <div className="p-4 pb-24 space-y-4">
      <header>
        <h1 className="text-xl font-bold text-slate-100">Train</h1>
        <p className="text-sm text-slate-400">Plan routines and log training sessions.</p>
      </header>

      <SegmentedControl options={TAB_OPTIONS} value={tab} onChange={setTab} ariaLabel="Training view" />

      {activeSession && !activeSession.finishedAt ? (
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
      ) : (
        // Start-a-workout hero: today's scheduled routine if there is one, else a
        // one-tap empty workout. Getting into a session should be the first thing.
        <Card className="bg-gradient-to-br from-emerald-500/15 to-slate-900 border-emerald-500/30 space-y-3">
          {todaysRoutine ? (
            <>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-400">Today's workout</p>
                <p className="text-lg font-bold text-slate-100">{todaysRoutine.name}</p>
                <p className="text-xs text-slate-400">
                  {todaysRoutine.items.length} exercise{todaysRoutine.items.length === 1 ? '' : 's'}
                </p>
              </div>
              <Button variant="primary" full onClick={() => startFromRoutine(todaysRoutine)}>
                Start workout
              </Button>
            </>
          ) : (
            <>
              <div>
                <p className="text-lg font-bold text-slate-100">Ready to train?</p>
                <p className="text-xs text-slate-400">Start an empty workout, or pick a routine below.</p>
              </div>
              <Button variant="primary" full onClick={quickStart}>
                Start workout
              </Button>
            </>
          )}
        </Card>
      )}

      {/* Cardio up front, so a run/ride/hike is visible the moment you open Train
          rather than three taps deep under Progress → Cardio. */}
      <CardioSummaryCard onSeeAll={openCardioDashboard} onLog={() => setLogActivityOpen(true)} />

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

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-200">Programs</h2>
          {programs.length > 0 && (
            <button
              type="button"
              onClick={() => setView({ kind: 'programEdit' })}
              className="text-xs font-medium text-emerald-400 active:text-emerald-300"
            >
              + New
            </button>
          )}
        </div>

        <Card
          className="active:bg-slate-800/60 flex items-center gap-3"
          onClick={() => setView({ kind: 'programs' })}
        >
          <div className="w-10 h-10 rounded-full bg-emerald-500/15 flex items-center justify-center text-emerald-400 shrink-0">
            <LayoutList size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-100">Browse program templates</p>
            <p className="text-xs text-slate-500">Start a ready-made plan in one tap</p>
          </div>
          <ChevronRight size={18} className="shrink-0 text-slate-500" />
        </Card>

        {programs.length === 0 ? (
          <Card className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/15 flex items-center justify-center text-emerald-400 shrink-0">
                <CalendarRange size={18} />
              </div>
              <p className="text-sm text-slate-300">
                Follow a multi-week plan with scheduled workouts — a guided program you tick off day by day.
              </p>
            </div>
            <Button
              variant="ghost"
              full
              disabled={routines.length === 0}
              onClick={() => setView({ kind: 'programEdit' })}
            >
              <span className="flex items-center justify-center gap-1.5">
                <Plus size={15} /> New program
              </span>
            </Button>
            {routines.length === 0 && (
              <p className="text-center text-xs text-slate-500">Create a routine first to build a program.</p>
            )}
          </Card>
        ) : (
          <div className="space-y-2">
            {programs.map((p) => {
              const done = p.completedDayIds.length
              const total = p.days.length
              return (
                <Card
                  key={p.id}
                  className="flex items-center gap-3 active:bg-slate-800/60"
                  onClick={() => setView({ kind: 'program', programId: p.id })}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-100">{p.name}</p>
                    <p className="truncate text-xs text-slate-500">
                      {done}/{total} workouts done
                    </p>
                  </div>
                  <ChevronRight size={18} className="shrink-0 text-slate-500" />
                </Card>
              )
            })}
          </div>
        )}
      </section>

      {/* Two ways in that aren't a routine: an empty tracked lifting session, or a
          one-off activity (run, yoga, hike) you just want on the record. */}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="ghost" full onClick={quickStart}>
          Empty workout
        </Button>
        <Button variant="primary" full onClick={() => setLogActivityOpen(true)}>
          <span className="flex items-center justify-center gap-1.5">
            <Plus size={16} /> Log activity
          </span>
        </Button>
      </div>

      {/* Today's calorie burn — finished workouts, logged activities, and quick
          calorie-only adds. The calories feed the daily budget shown on Diet. */}
      <ExerciseCard date={todayISO()} />

      <Card className="active:bg-slate-800/60 flex items-center gap-3" onClick={() => setView({ kind: 'library' })}>
        <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-primary-400 shrink-0">
          <Dumbbell size={18} />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-100">Exercise library</p>
          <p className="text-xs text-slate-500">Browse exercises by muscle group</p>
        </div>
      </Card>

      {/* The last few sessions, with their top sets, rather than only a count. */}
      <RecentWorkoutsCard
        onSeeAll={() => setView({ kind: 'history' })}
        onRepeated={() => setView({ kind: 'session' })}
      />

      <Card className="active:bg-slate-800/60 flex items-center gap-3" onClick={() => setView({ kind: 'history' })}>
        <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-primary-400 shrink-0">
          <History size={18} />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-100">All history</p>
          <p className="text-xs text-slate-500">
            {finishedCount} finished workout{finishedCount === 1 ? '' : 's'}
          </p>
        </div>
      </Card>

      <Card className="active:bg-slate-800/60 flex items-center gap-3" onClick={() => setView({ kind: 'stats' })}>
        <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-primary-400 shrink-0">
          <BarChart3 size={18} />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-100">Statistics</p>
          <p className="text-xs text-slate-500">Lifetime totals & muscle balance</p>
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

      <LogActivitySheet open={logActivityOpen} onClose={() => setLogActivityOpen(false)} />
    </div>
  )
}

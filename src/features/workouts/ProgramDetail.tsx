import { useMemo } from 'react'
import { Check, ChevronLeft, Pencil } from 'lucide-react'
import Card from '../../components/Card'
import Button from '../../components/Button'
import { useWorkoutsStore } from '../../store/workouts'
import { todayISO } from '../../lib/date'
import { lastWeightForExercise } from './utils'
import type { ProgramDay, WorkoutSessionEntry } from '../../types'

type ProgramDetailProps = {
  programId: string
  onStartSession: () => void
  onEdit: () => void
  onDone: () => void
}

export default function ProgramDetail({ programId, onStartSession, onEdit, onDone }: ProgramDetailProps) {
  const programs = useWorkoutsStore((s) => s.programs)
  const routines = useWorkoutsStore((s) => s.routines)
  const sessions = useWorkoutsStore((s) => s.sessions)
  const startSession = useWorkoutsStore((s) => s.startSession)
  const setActiveProgram = useWorkoutsStore((s) => s.setActiveProgram)

  const program = programs.find((p) => p.id === programId)

  const orderedDays = useMemo(
    () => (program ? [...program.days].sort((a, b) => a.week - b.week) : []),
    [program],
  )
  const nextDay = useMemo(
    () => orderedDays.find((d) => !program!.completedDayIds.includes(d.id)),
    [orderedDays, program],
  )

  if (!program) {
    return (
      <div className="p-4 space-y-4">
        <p className="text-sm text-slate-400">This program is no longer available.</p>
        <Button variant="ghost" full onClick={onDone}>
          Back
        </Button>
      </div>
    )
  }

  function startDay(day: ProgramDay) {
    const routine = routines.find((r) => r.id === day.routineId)
    if (!routine) return
    const entries: WorkoutSessionEntry[] = routine.items.map((item) => ({
      exerciseId: item.exerciseId,
      sets: Array.from({ length: item.targetSets }, () => ({
        reps: item.targetReps,
        weight: lastWeightForExercise(sessions, item.exerciseId),
        done: false,
      })),
    }))
    setActiveProgram(program!.id)
    startSession({
      routineId: routine.id,
      programDayId: day.id,
      name: `${program!.name} · ${day.name}`,
      date: todayISO(),
      startedAt: Date.now(),
      entries,
    })
    onStartSession()
  }

  const doneCount = program.completedDayIds.length
  const total = program.days.length
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0

  const weeks = Array.from(new Set(orderedDays.map((d) => d.week))).sort((a, b) => a - b)

  return (
    <div className="p-4 pb-24 space-y-4">
      <button
        type="button"
        onClick={onDone}
        className="flex items-center gap-1 text-sm text-slate-400 active:text-slate-200"
      >
        <ChevronLeft size={16} /> Back
      </button>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-slate-100">{program.name}</h1>
          <p className="text-sm text-slate-400">
            {doneCount}/{total} workouts done
          </p>
        </div>
        <button
          type="button"
          onClick={onEdit}
          aria-label="Edit program"
          className="shrink-0 w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 active:bg-slate-700"
        >
          <Pencil size={16} />
        </button>
      </div>

      <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
        <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
      </div>

      {nextDay && (
        <Card className="bg-gradient-to-br from-emerald-500/15 to-slate-900 border-emerald-500/30 space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-400">Up next</p>
            <p className="text-lg font-bold text-slate-100">{nextDay.name}</p>
            <p className="text-xs text-slate-400">Week {nextDay.week}</p>
          </div>
          <Button variant="primary" full onClick={() => startDay(nextDay)}>
            Start workout
          </Button>
        </Card>
      )}

      {!nextDay && (
        <Card className="text-center space-y-1">
          <p className="text-sm font-semibold text-emerald-400">Program complete 🎉</p>
          <p className="text-xs text-slate-400">Nice work — every workout is done.</p>
        </Card>
      )}

      {weeks.map((week) => (
        <div key={week} className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-200">Week {week}</h2>
          <div className="space-y-2">
            {orderedDays
              .filter((d) => d.week === week)
              .map((day) => {
                const done = program.completedDayIds.includes(day.id)
                const isNext = nextDay?.id === day.id
                const routine = routines.find((r) => r.id === day.routineId)
                return (
                  <Card
                    key={day.id}
                    className={`flex items-center gap-3 ${isNext ? 'border-emerald-500/40' : ''}`}
                  >
                    <div
                      className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                        done ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {done ? <Check size={16} strokeWidth={3} /> : <span className="text-xs">{day.week}</span>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-100">{day.name}</p>
                      <p className="truncate text-xs text-slate-500">
                        {routine?.name ?? 'Missing routine'}
                        {done ? ' · done' : ''}
                      </p>
                    </div>
                    {!done && (
                      <Button variant={isNext ? 'primary' : 'ghost'} onClick={() => startDay(day)}>
                        Start
                      </Button>
                    )}
                  </Card>
                )
              })}
          </div>
        </div>
      ))}
    </div>
  )
}

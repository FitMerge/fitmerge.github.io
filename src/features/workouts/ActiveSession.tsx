import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Calculator, Info, MoreVertical, Repeat, Trash2, Trophy } from 'lucide-react'
import Card from '../../components/Card'
import Button from '../../components/Button'
import Sheet from '../../components/Sheet'
import ExercisePicker from './ExercisePicker'
import ExerciseDetailSheet from './ExerciseDetailSheet'
import SwapExerciseSheet from './SwapExerciseSheet'
import PlateCalculatorSheet from './PlateCalculatorSheet'
import SetRow from './SetRow'
import RestTimerBar from './RestTimerBar'
import { useWorkoutsStore } from '../../store/workouts'
import { useSettingsStore } from '../../store/settings'
import { getExerciseById } from '../../data/exercises'
import { epley1RM } from '../progress/utils'
import {
  DEFAULT_REST_SEC,
  formatElapsed,
  isWorkingSet,
  lastWeightForExercise,
  previousSessionSets,
  priorBest1RM,
  priorBestSetVolume,
  priorBestWeight,
  totalSetsDone,
  totalVolume,
  weightUnitLabel,
} from './utils'
import { detectPRs, type PRBars } from './prDetect'
import PRToast, { type PRCelebration } from './PRToast'
import { beep, primeAudio, vibrate } from '../../lib/beep'
import type { ReactNode } from 'react'
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
  const completeProgramDay = useWorkoutsStore((s) => s.completeProgramDay)
  const units = useSettingsStore((s) => s.units)
  const restTimerSound = useSettingsStore((s) => s.restTimerSound)
  const setRestTimerSound = useSettingsStore((s) => s.setRestTimerSound)

  const session = sessions.find((s) => s.id === sessionId)
  const routine = useMemo(
    () => (session?.routineId ? routines.find((r) => r.id === session.routineId) : undefined),
    [routines, session?.routineId],
  )

  const [now, setNow] = useState(() => Date.now())
  const [restTimer, setRestTimer] = useState<RestTimerState | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [finishOpen, setFinishOpen] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  // When set, the comparable-swap sheet is open for this exercise.
  const [swapId, setSwapId] = useState<string | null>(null)
  // Exercise ids whose action row / note editor is expanded.
  const [expandedActions, setExpandedActions] = useState<Set<string>>(() => new Set())
  const [plateWeight, setPlateWeight] = useState<number | null>(null)
  const [prCelebration, setPrCelebration] = useState<PRCelebration | null>(null)
  // Guards the rest-timer alert so it dings exactly once per timer, and gives each
  // PR celebration a unique id.
  const restAlerted = useRef(false)
  const prSeq = useRef(0)

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

  // Ding + buzz once when the rest timer reaches zero (if the user has it on).
  useEffect(() => {
    if (restTimer && restTimer.secondsLeft <= 0 && !restAlerted.current) {
      restAlerted.current = true
      if (restTimerSound) {
        beep()
        vibrate([120, 60, 120])
      }
    }
  }, [restTimer, restTimerSound])

  // Per-exercise reference data: previous session's sets (ghost hints) and the
  // est-1RM bar a new set must clear to count as a personal record.
  const prevByExercise = useMemo(() => {
    const map: Record<string, SetLog[] | null> = {}
    for (const e of session?.entries ?? []) {
      map[e.exerciseId] = previousSessionSets(sessions, e.exerciseId, session?.id)
    }
    return map
  }, [sessions, session?.entries, session?.id])

  const priorBestByExercise = useMemo(() => {
    const map: Record<string, number> = {}
    for (const e of session?.entries ?? []) {
      map[e.exerciseId] = priorBest1RM(sessions, e.exerciseId, session?.id)
    }
    return map
  }, [sessions, session?.entries, session?.id])

  // All-time bars (weight / est-1RM / best-set volume) a completed set must beat
  // to trigger a personal-record celebration.
  const priorBarsByExercise = useMemo(() => {
    const map: Record<string, PRBars> = {}
    for (const e of session?.entries ?? []) {
      map[e.exerciseId] = {
        best1rm: priorBest1RM(sessions, e.exerciseId, session?.id),
        bestWeight: priorBestWeight(sessions, e.exerciseId, session?.id),
        bestVolume: priorBestSetVolume(sessions, e.exerciseId, session?.id),
      }
    }
    return map
  }, [sessions, session?.entries, session?.id])

  // Exercises where this session's best working set beats the previous all-time best.
  const prSet = useMemo(() => {
    const map: Record<string, number> = {} // exerciseId -> set index of the PR set
    for (const e of session?.entries ?? []) {
      const prior = priorBestByExercise[e.exerciseId] ?? 0
      if (prior <= 0) continue
      let bestIdx = -1
      let bestVal = prior
      e.sets.forEach((s, i) => {
        if (!isWorkingSet(s)) return
        const est = epley1RM(s.weight, s.reps)
        if (est > bestVal) {
          bestVal = est
          bestIdx = i
        }
      })
      if (bestIdx >= 0) map[e.exerciseId] = bestIdx
    }
    return map
  }, [session?.entries, priorBestByExercise])

  const newPRs = useMemo(() => {
    return Object.entries(prSet).map(([exerciseId, idx]) => {
      const entry = session?.entries.find((e) => e.exerciseId === exerciseId)
      const set = entry?.sets[idx]
      return {
        name: getExerciseById(exerciseId)?.name ?? 'Exercise',
        weight: set?.weight ?? 0,
        reps: set?.reps ?? 0,
      }
    })
  }, [prSet, session?.entries])

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
    // Entering a weight cascades to the later sets you haven't completed yet, so
    // you don't re-type the same load for every set of an exercise.
    const cascadeWeight = 'weight' in patch ? (patch.weight as number) : undefined
    patchEntries(
      session!.entries.map((e) =>
        e.exerciseId === exerciseId
          ? {
              ...e,
              sets: e.sets.map((s, i) => {
                if (i === setIdx) return { ...s, ...patch }
                if (cascadeWeight !== undefined && i > setIdx && !s.done) return { ...s, weight: cascadeWeight }
                return s
              }),
            }
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

  // Swap an exercise for a comparable one, keeping its logged sets in place.
  function swapExercise(fromId: string, exercise: Exercise) {
    if (fromId !== exercise.id && !session!.entries.some((e) => e.exerciseId === exercise.id)) {
      patchEntries(session!.entries.map((e) => (e.exerciseId === fromId ? { ...e, exerciseId: exercise.id } : e)))
    }
  }

  function moveEntry(exerciseId: string, dir: -1 | 1) {
    const idx = session!.entries.findIndex((e) => e.exerciseId === exerciseId)
    const target = idx + dir
    if (idx < 0 || target < 0 || target >= session!.entries.length) return
    const next = [...session!.entries]
    ;[next[idx], next[target]] = [next[target], next[idx]]
    patchEntries(next)
  }

  function removeEntry(exerciseId: string) {
    patchEntries(session!.entries.filter((e) => e.exerciseId !== exerciseId))
  }

  function setEntryNote(exerciseId: string, note: string) {
    patchEntries(
      session!.entries.map((e) => (e.exerciseId === exerciseId ? { ...e, note: note || undefined } : e)),
    )
  }

  function toggleActions(exerciseId: string) {
    setExpandedActions((prev) => {
      const next = new Set(prev)
      if (next.has(exerciseId)) next.delete(exerciseId)
      else next.add(exerciseId)
      return next
    })
  }

  function handleCheckedOn(exerciseId: string, setIdx: number) {
    // Start the rest timer, and prime audio now (this is a user gesture) so the
    // end-of-rest ding is allowed to play later.
    const total = restSecFor(exerciseId)
    restAlerted.current = false
    primeAudio()
    setRestTimer({ total, secondsLeft: total })
    checkForPRs(exerciseId, setIdx)
  }

  // Celebrate when the just-completed set beats a personal record — bars are the
  // max of all-time history and what's already been hit earlier this session.
  function checkForPRs(exerciseId: string, setIdx: number) {
    const entry = session!.entries.find((e) => e.exerciseId === exerciseId)
    const set = entry?.sets[setIdx]
    if (!entry || !set || (set.type && set.type !== 'normal')) return
    const priors = priorBarsByExercise[exerciseId] ?? { best1rm: 0, bestWeight: 0, bestVolume: 0 }
    // Fold in the best already logged earlier this session so escalating sets each
    // celebrate a genuinely new record rather than re-firing.
    const bars: PRBars = { ...priors }
    entry.sets.forEach((s, i) => {
      if (i === setIdx || !s.done || !isWorkingSet(s)) return
      bars.best1rm = Math.max(bars.best1rm, epley1RM(s.weight, s.reps))
      bars.bestWeight = Math.max(bars.bestWeight, s.weight)
      bars.bestVolume = Math.max(bars.bestVolume, s.weight * s.reps)
    })
    const hits = detectPRs(set.weight, set.reps, bars)
    if (hits.length > 0) {
      setPrCelebration({ id: ++prSeq.current, exerciseName: getExerciseById(exerciseId)?.name ?? 'Exercise', hits })
      vibrate(60)
    }
  }

  function finishSession() {
    updateSession(session!.id, { finishedAt: Date.now() })
    if (session!.programDayId) completeProgramDay(session!.programDayId)
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
  const totalSets = session.entries.reduce((n, e) => n + e.sets.length, 0)
  const progressPct = totalSets > 0 ? Math.round((setsDone / totalSets) * 100) : 0

  return (
    <div className="p-4 pb-24 space-y-4">
      <header className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-slate-100 truncate">{session.name}</h1>
            <p className="text-xs text-slate-400 tabular-nums">
              {formatElapsed(elapsedMs)} · {setsDone}/{totalSets} sets ·{' '}
              {Math.round(volume).toLocaleString()} {weightUnitLabel(units)}
            </p>
          </div>
          <Button variant="primary" onClick={() => setFinishOpen(true)}>
            Finish
          </Button>
        </div>
        <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </header>

      <div className="space-y-3">
        {session.entries.length === 0 ? (
          <p className="text-sm text-slate-500">No exercises yet. Add one to get started.</p>
        ) : (
          session.entries.map((entry, entryIdx) => {
            const exercise = getExerciseById(entry.exerciseId)
            const prevSets = prevByExercise[entry.exerciseId] ?? null
            const prIdx = prSet[entry.exerciseId]
            const actionsOpen = expandedActions.has(entry.exerciseId)
            const topWeight = Math.max(0, ...entry.sets.map((s) => s.weight))
            const routineNote = routine?.items.find((it) => it.exerciseId === entry.exerciseId)?.note
            const displayNote = entry.note ?? routineNote
            return (
              <Card key={entry.exerciseId}>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setDetailId(entry.exerciseId)}
                    className="flex min-w-0 items-center gap-1.5 text-left"
                  >
                    <h3 className="truncate text-sm font-semibold text-slate-100">
                      {exercise?.name ?? 'Unknown exercise'}
                    </h3>
                    <Info size={13} className="shrink-0 text-slate-500" />
                  </button>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-slate-500 tabular-nums">
                      {entry.sets.filter((s) => s.done).length}/{entry.sets.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleActions(entry.exerciseId)}
                      aria-label="Exercise options"
                      className={`flex h-7 w-7 items-center justify-center rounded-full ${
                        actionsOpen ? 'bg-slate-700 text-slate-200' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      <MoreVertical size={15} />
                    </button>
                  </div>
                </div>

                {actionsOpen && (
                  <div className="mb-2 space-y-2 rounded-lg bg-slate-800/50 p-2">
                    <div className="flex flex-wrap gap-1.5">
                      <ActionBtn icon={<ArrowUp size={13} />} label="Up" disabled={entryIdx === 0} onClick={() => moveEntry(entry.exerciseId, -1)} />
                      <ActionBtn icon={<ArrowDown size={13} />} label="Down" disabled={entryIdx === session.entries.length - 1} onClick={() => moveEntry(entry.exerciseId, 1)} />
                      <ActionBtn icon={<Repeat size={13} />} label="Swap" onClick={() => setSwapId(entry.exerciseId)} />
                      <ActionBtn icon={<Calculator size={13} />} label="Plates" onClick={() => setPlateWeight(topWeight)} />
                      <ActionBtn icon={<Trash2 size={13} />} label="Remove" danger onClick={() => removeEntry(entry.exerciseId)} />
                    </div>
                    <input
                      type="text"
                      value={entry.note ?? ''}
                      onChange={(e) => setEntryNote(entry.exerciseId, e.target.value)}
                      placeholder="Add a note (form cue, tweak…)"
                      className="w-full rounded-lg bg-slate-900 px-2.5 py-2 text-xs text-slate-200 placeholder:text-slate-600 outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                )}

                {displayNote && !actionsOpen && (
                  <p className="mb-2 rounded-md bg-slate-800/40 px-2 py-1 text-[11px] italic text-slate-400">
                    {displayNote}
                  </p>
                )}

                <div className="grid grid-cols-[2rem_1fr_1fr_1fr_2.25rem] gap-1.5 px-0.5 pb-1 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                  <span className="text-center">Set</span>
                  <span className="text-center">Prev</span>
                  <span className="text-center">{weightUnitLabel(units)}</span>
                  <span className="text-center">Reps</span>
                  <span />
                </div>
                <div className="divide-y divide-slate-800">
                  {entry.sets.map((set, idx) => (
                    <SetRow
                      key={idx}
                      index={idx}
                      set={set}
                      units={units}
                      previous={prevSets?.[idx]}
                      isPR={prIdx === idx}
                      onChange={(patch) => patchSet(entry.exerciseId, idx, patch)}
                      onCheckedOn={() => handleCheckedOn(entry.exerciseId, idx)}
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
          soundOn={restTimerSound}
          onToggleSound={() => {
            primeAudio()
            setRestTimerSound(!restTimerSound)
          }}
          onAddTime={() => setRestTimer((r) => (r ? { total: r.total + 15, secondsLeft: r.secondsLeft + 15 } : r))}
          onSkip={() => setRestTimer(null)}
        />
      )}

      <ExercisePicker open={pickerOpen} onClose={() => setPickerOpen(false)} onPick={addExerciseEntry} />

      <SwapExerciseSheet
        open={swapId !== null}
        fromExerciseId={swapId}
        onClose={() => setSwapId(null)}
        onSwap={(exercise) => {
          if (swapId) swapExercise(swapId, exercise)
          setSwapId(null)
        }}
      />

      <PRToast celebration={prCelebration} units={units} onDone={() => setPrCelebration(null)} />

      <ExerciseDetailSheet exerciseId={detailId} onClose={() => setDetailId(null)} />

      <PlateCalculatorSheet
        open={plateWeight !== null}
        onClose={() => setPlateWeight(null)}
        initialWeight={plateWeight ?? undefined}
      />

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

          {newPRs.length > 0 && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-300">
                <Trophy size={15} /> {newPRs.length} new personal record{newPRs.length > 1 ? 's' : ''}!
              </p>
              <ul className="mt-1.5 space-y-0.5">
                {newPRs.map((pr, i) => (
                  <li key={i} className="text-xs text-slate-300">
                    <span className="font-medium text-slate-100">{pr.name}</span> · {pr.weight} ×{' '}
                    {pr.reps} {weightUnitLabel(units)}
                  </li>
                ))}
              </ul>
            </div>
          )}

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

function ActionBtn({
  icon,
  label,
  onClick,
  disabled,
  danger,
}: {
  icon: ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium disabled:opacity-30 ${
        danger ? 'bg-red-500/15 text-red-400' : 'bg-slate-700/70 text-slate-200'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}

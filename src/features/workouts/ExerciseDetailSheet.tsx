import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { Dumbbell, Target, TrendingUp } from 'lucide-react'
import Sheet from '../../components/Sheet'
import MuscleMap from '../../components/MuscleMap'
import { useWorkoutsStore } from '../../store/workouts'
import { useSettingsStore } from '../../store/settings'
import { getExerciseById } from '../../data/exercises'
import { muscleLabel } from '../../data/muscles'
import { epley1RM } from '../progress/utils'
import { weightUnitLabel } from './utils'
import type { WorkoutSession } from '../../types'

type ExerciseDetailSheetProps = {
  exerciseId: string | null
  onClose: () => void
  /** Optional callback to jump to the full progress chart for this exercise. */
  onViewProgress?: (exerciseId: string) => void
}

type BestSet = { est1RM: number; weight: number; reps: number; sessions: number }

/** Best working set (by est-1RM) for an exercise across finished sessions. */
function bestSetFor(sessions: WorkoutSession[], exerciseId: string): BestSet | null {
  let best: BestSet | null = null
  let count = 0
  for (const session of sessions) {
    if (!session.finishedAt) continue
    const entry = session.entries.find((e) => e.exerciseId === exerciseId)
    if (!entry) continue
    let hit = false
    for (const set of entry.sets) {
      if (!set.done || set.type === 'warmup' || set.reps <= 0 || set.weight <= 0) continue
      hit = true
      const est1RM = epley1RM(set.weight, set.reps)
      if (!best || est1RM > best.est1RM) best = { est1RM, weight: set.weight, reps: set.reps, sessions: 0 }
    }
    if (hit) count += 1
  }
  return best ? { ...best, sessions: count } : null
}

export default function ExerciseDetailSheet({ exerciseId, onClose, onViewProgress }: ExerciseDetailSheetProps) {
  const sessions = useWorkoutsStore((s) => s.sessions)
  const units = useSettingsStore((s) => s.units)
  const unitLabel = weightUnitLabel(units)
  const exercise = exerciseId ? getExerciseById(exerciseId) : undefined

  const best = useMemo(
    () => (exerciseId ? bestSetFor(sessions, exerciseId) : null),
    [sessions, exerciseId],
  )

  if (!exercise) return <Sheet open={false} onClose={onClose} />

  const primary = exercise.primaryMuscles ?? []
  const secondary = exercise.secondaryMuscles ?? []
  const steps = exercise.steps ?? (exercise.instructions ? [exercise.instructions] : [])

  return (
    <Sheet open={exerciseId !== null} onClose={onClose} title={exercise.name}>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-1.5">
          <Chip icon={<Target size={12} />} text={exercise.muscleGroup} />
          <Chip icon={<Dumbbell size={12} />} text={exercise.equipment} />
        </div>

        <div className="rounded-xl bg-slate-800/40 py-3">
          <MuscleMap primary={primary} secondary={secondary} />
        </div>

        {(primary.length > 0 || secondary.length > 0) && (
          <div className="space-y-2">
            {primary.length > 0 && (
              <MuscleRow label="Primary" dot={PRIMARY_DOT} names={primary.map(muscleLabel)} />
            )}
            {secondary.length > 0 && (
              <MuscleRow label="Secondary" dot={SECONDARY_DOT} names={secondary.map(muscleLabel)} />
            )}
          </div>
        )}

        {best && (
          <button
            type="button"
            onClick={() => exerciseId && onViewProgress?.(exerciseId)}
            disabled={!onViewProgress}
            className="w-full text-left rounded-xl bg-slate-800/60 p-3 active:bg-slate-800 disabled:active:bg-slate-800/60"
          >
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
                <TrendingUp size={13} className="text-primary-400" /> Personal best
              </span>
              {onViewProgress && <span className="text-[11px] text-primary-400">View progress ›</span>}
            </div>
            <div className="mt-1.5 flex items-baseline gap-3">
              <span className="text-lg font-bold text-slate-100">
                {best.weight} × {best.reps}
                <span className="ml-1 text-xs font-normal text-slate-500">{unitLabel}</span>
              </span>
              <span className="text-xs text-slate-400">
                est. 1RM <span className="font-semibold text-slate-200">{best.est1RM.toFixed(1)}</span> {unitLabel}
              </span>
            </div>
          </button>
        )}

        {steps.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">How to</h3>
            <ol className="space-y-2">
              {steps.map((step, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-500/15 text-[11px] font-bold text-primary-400">
                    {i + 1}
                  </span>
                  <span className="text-sm leading-relaxed text-slate-300">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </Sheet>
  )
}

const PRIMARY_DOT = '#34d399'
const SECONDARY_DOT = '#0f766e'

function MuscleRow({ label, dot, names }: { label: string; dot: string; names: string[] }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: dot }} />
      <span className="text-xs text-slate-500">{label}:</span>
      <span className="text-xs font-medium text-slate-200">{names.join(', ')}</span>
    </div>
  )
}

function Chip({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-300">
      {icon}
      {text}
    </span>
  )
}

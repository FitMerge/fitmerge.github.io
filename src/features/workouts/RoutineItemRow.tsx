import { ChevronDown, ChevronUp, X } from 'lucide-react'
import Card from '../../components/Card'
import CompactStepper from './CompactStepper'
import { getExerciseById } from '../../data/exercises'
import type { RoutineItem } from '../../types'

type RoutineItemRowProps = {
  item: RoutineItem
  isFirst: boolean
  isLast: boolean
  onChange: (patch: Partial<RoutineItem>) => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}

export default function RoutineItemRow({
  item,
  isFirst,
  isLast,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: RoutineItemRowProps) {
  const exercise = getExerciseById(item.exerciseId)

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-100 truncate">{exercise?.name ?? 'Unknown exercise'}</p>
          <p className="text-xs text-slate-500">{exercise?.muscleGroup}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={isFirst}
            aria-label="Move up"
            className="w-9 h-9 rounded-full bg-slate-800 active:bg-slate-700 flex items-center justify-center text-slate-400 disabled:opacity-30"
          >
            <ChevronUp size={14} />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={isLast}
            aria-label="Move down"
            className="w-9 h-9 rounded-full bg-slate-800 active:bg-slate-700 flex items-center justify-center text-slate-400 disabled:opacity-30"
          >
            <ChevronDown size={14} />
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove exercise"
            className="w-9 h-9 rounded-full bg-slate-800 active:bg-slate-700 flex items-center justify-center text-red-400"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <CompactStepper
          label="Sets"
          value={item.targetSets}
          onChange={(v) => onChange({ targetSets: v })}
          step={1}
          min={1}
        />
        <CompactStepper
          label="Reps"
          value={item.targetReps}
          onChange={(v) => onChange({ targetReps: v })}
          step={1}
          min={1}
        />
        <CompactStepper
          label="Rest"
          value={item.restSec}
          onChange={(v) => onChange({ restSec: v })}
          step={15}
          min={0}
          suffix="s"
        />
      </div>

      <input
        type="text"
        value={item.note ?? ''}
        onChange={(e) => onChange({ note: e.target.value || undefined })}
        placeholder="Note (optional) — e.g. tempo 3-1-1, last set to failure"
        className="w-full rounded-lg bg-slate-800 px-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-primary-500"
      />
    </Card>
  )
}

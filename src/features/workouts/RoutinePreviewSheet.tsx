import Sheet from '../../components/Sheet'
import Button from '../../components/Button'
import { getExerciseById } from '../../data/exercises'
import type { Routine } from '../../types'

type RoutinePreviewSheetProps = {
  routine: Routine | null
  onClose: () => void
  onStart: (routine: Routine) => void
  onEdit: (routine: Routine) => void
}

export default function RoutinePreviewSheet({ routine, onClose, onStart, onEdit }: RoutinePreviewSheetProps) {
  return (
    <Sheet open={routine !== null} onClose={onClose} title={routine?.name ?? ''}>
      {routine && (
        <div className="space-y-4">
          {routine.notes && <p className="text-sm text-slate-400">{routine.notes}</p>}

          <div className="space-y-2">
            {routine.items.map((item, idx) => {
              const exercise = getExerciseById(item.exerciseId)
              return (
                <div
                  key={`${item.exerciseId}-${idx}`}
                  className="flex items-center justify-between gap-3 rounded-xl bg-slate-800/60 px-3 py-2.5"
                >
                  <p className="text-sm text-slate-100 truncate">{exercise?.name ?? 'Unknown exercise'}</p>
                  <p className="shrink-0 text-xs text-slate-400">
                    {item.targetSets} × {item.targetReps} · {item.restSec}s rest
                  </p>
                </div>
              )
            })}
          </div>

          <Button variant="primary" full onClick={() => onStart(routine)}>
            Start workout
          </Button>
          <Button variant="ghost" full onClick={() => onEdit(routine)}>
            Edit
          </Button>
        </div>
      )}
    </Sheet>
  )
}

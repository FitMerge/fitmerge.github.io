import { useMemo, useState } from 'react'
import Sheet from '../../components/Sheet'
import Button from '../../components/Button'
import ExercisePicker from './ExercisePicker'
import { getExerciseById } from '../../data/exercises'
import { useSettingsStore } from '../../store/settings'
import { suggestSwaps } from './swap'
import type { Exercise } from '../../types'

type SwapExerciseSheetProps = {
  open: boolean
  /** The exercise being replaced. */
  fromExerciseId: string | null
  onClose: () => void
  onSwap: (exercise: Exercise) => void
}

const MAX_SHOWN = 14

/** Pick a comparable exercise to swap in — muscle-matched and, by default,
 * filtered to the equipment you own. Falls back to the full library. */
export default function SwapExerciseSheet({ open, fromExerciseId, onClose, onSwap }: SwapExerciseSheetProps) {
  const available = useSettingsStore((s) => s.availableEquipment)
  const hasEquipPref = available !== undefined && available.length > 0
  const [onlyMine, setOnlyMine] = useState(true)
  const [browseAll, setBrowseAll] = useState(false)

  const from = fromExerciseId ? getExerciseById(fromExerciseId) : undefined
  const suggestions = useMemo(
    () => (fromExerciseId ? suggestSwaps(fromExerciseId, available) : []),
    [fromExerciseId, available],
  )

  const shown = useMemo(() => {
    const list = onlyMine && hasEquipPref ? suggestions.filter((s) => s.available) : suggestions
    return list.slice(0, MAX_SHOWN)
  }, [suggestions, onlyMine, hasEquipPref])

  function pick(exercise: Exercise) {
    onSwap(exercise)
    setBrowseAll(false)
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title={from ? `Swap ${from.name}` : 'Swap exercise'}>
      <div className="space-y-3">
        {from && (
          <p className="text-xs text-slate-500">
            Comparable moves for <span className="text-slate-300">{from.name}</span> · {from.muscleGroup}
          </p>
        )}

        {hasEquipPref && (
          <button
            type="button"
            role="switch"
            aria-checked={onlyMine}
            onClick={() => setOnlyMine((v) => !v)}
            className="flex w-full items-center justify-between rounded-lg bg-slate-800/60 px-3 py-2 text-left"
          >
            <span className="text-xs text-slate-300">Only equipment I have</span>
            <span className={`relative h-6 w-10 shrink-0 rounded-full transition ${onlyMine ? 'bg-primary-500' : 'bg-slate-700'}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${onlyMine ? 'left-[18px]' : 'left-0.5'}`} />
            </span>
          </button>
        )}

        <div className="space-y-2 max-h-[50vh] overflow-y-auto">
          {shown.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">
              No comparable exercises for your equipment — turn off the filter or browse all.
            </p>
          ) : (
            shown.map(({ exercise, matchLabel, available: avail }) => (
              <button
                key={exercise.id}
                type="button"
                onClick={() => pick(exercise)}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-left active:bg-slate-800/60"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-slate-100">{exercise.name}</p>
                  <p className="text-xs text-slate-500">
                    {exercise.muscleGroup} · {exercise.equipment}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <span className="block text-[10px] font-medium text-primary-300">{matchLabel}</span>
                  {!avail && <span className="block text-[10px] text-amber-400">not in your kit</span>}
                </div>
              </button>
            ))
          )}
        </div>

        <Button variant="ghost" full onClick={() => setBrowseAll(true)}>
          Browse all exercises
        </Button>
      </div>

      <ExercisePicker open={browseAll} onClose={() => setBrowseAll(false)} onPick={pick} title="Pick any exercise" />
    </Sheet>
  )
}

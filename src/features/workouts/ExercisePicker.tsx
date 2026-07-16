import { Search } from 'lucide-react'
import Sheet from '../../components/Sheet'
import Button from '../../components/Button'
import { useExerciseFilter, FILTER_GROUPS } from './useExerciseFilter'
import type { Exercise } from '../../types'

type ExercisePickerProps = {
  open: boolean
  onClose: () => void
  onPick: (exercise: Exercise) => void
  title?: string
}

export default function ExercisePicker({ open, onClose, onPick, title = 'Add exercise' }: ExercisePickerProps) {
  const { query, setQuery, group, setGroup, filtered } = useExerciseFilter()

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="space-y-3">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                e.currentTarget.blur()
              }
            }}
            enterKeyHint="search"
            placeholder="Search exercises…"
            className="w-full bg-slate-800 rounded-lg pl-9 pr-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {FILTER_GROUPS.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGroup(g)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap ${
                group === g ? 'bg-primary-500 text-slate-950 font-semibold' : 'bg-slate-800 text-slate-300'
              }`}
            >
              {g}
            </button>
          ))}
        </div>

        <div className="space-y-2 max-h-[50vh] overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">No exercises found</p>
          ) : (
            filtered.map((exercise) => (
              <button
                key={exercise.id}
                type="button"
                onClick={() => onPick(exercise)}
                className="w-full flex items-center justify-between gap-3 rounded-xl bg-slate-900 border border-slate-800 active:bg-slate-800/60 px-3 py-2.5 text-left"
              >
                <div className="min-w-0">
                  <p className="text-sm text-slate-100 truncate">{exercise.name}</p>
                  <p className="text-xs text-slate-500">
                    {exercise.muscleGroup} · {exercise.equipment}
                  </p>
                </div>
                <span className="shrink-0 text-lg text-primary-400 leading-none">+</span>
              </button>
            ))
          )}
        </div>

        <Button variant="ghost" full onClick={onClose}>
          Done
        </Button>
      </div>
    </Sheet>
  )
}

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Search, TrendingUp } from 'lucide-react'
import Card from '../../components/Card'
import ExerciseProgressSheet from './ExerciseProgressSheet'
import ExerciseDetailSheet from './ExerciseDetailSheet'
import MuscleMap from '../../components/MuscleMap'
import { useExerciseFilter, FILTER_GROUPS } from './useExerciseFilter'
import { useWorkoutsStore } from '../../store/workouts'
import { exerciseIdsWithHistory } from './utils'

type ExerciseLibraryProps = {
  onBack: () => void
}

export default function ExerciseLibrary({ onBack }: ExerciseLibraryProps) {
  const { query, setQuery, group, setGroup, filtered } = useExerciseFilter()
  const [detailId, setDetailId] = useState<string | null>(null)
  const [progressExerciseId, setProgressExerciseId] = useState<string | null>(null)
  const sessions = useWorkoutsStore((s) => s.sessions)
  const historyIds = useMemo(() => exerciseIdsWithHistory(sessions), [sessions])

  return (
    <div className="p-4 pb-24 space-y-4">
      <header className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="w-9 h-9 rounded-full bg-slate-800 active:bg-slate-700 flex items-center justify-center text-slate-300"
        >
          <ChevronLeft size={18} />
        </button>
        <h1 className="text-lg font-bold text-slate-100">Exercise library</h1>
      </header>

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

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <p className="text-sm text-slate-500 py-8 text-center">No exercises found</p>
        ) : (
          filtered.map((exercise) => (
            <Card
              key={exercise.id}
              className="p-3 active:bg-slate-800/60"
              onClick={() => setDetailId(exercise.id)}
            >
              <div className="flex items-center gap-3">
                <div className="shrink-0 rounded-lg bg-slate-800/60 p-1">
                  <MuscleMap
                    primary={exercise.primaryMuscles ?? []}
                    secondary={exercise.secondaryMuscles ?? []}
                    className="[&_svg]:h-11 gap-1"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-100 truncate">{exercise.name}</p>
                  <p className="text-xs text-slate-500">
                    {exercise.muscleGroup} · {exercise.equipment}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {historyIds.has(exercise.id) && (
                    <button
                      type="button"
                      aria-label="View progress"
                      onClick={(e) => {
                        e.stopPropagation()
                        setProgressExerciseId(exercise.id)
                      }}
                      className="w-8 h-8 rounded-full bg-slate-800 active:bg-slate-700 flex items-center justify-center text-primary-400"
                    >
                      <TrendingUp size={15} />
                    </button>
                  )}
                  <ChevronRight size={16} className="text-slate-500" />
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      <ExerciseDetailSheet
        exerciseId={detailId}
        onClose={() => setDetailId(null)}
        onViewProgress={(id) => {
          setDetailId(null)
          setProgressExerciseId(id)
        }}
      />
      <ExerciseProgressSheet exerciseId={progressExerciseId} onClose={() => setProgressExerciseId(null)} />
    </div>
  )
}

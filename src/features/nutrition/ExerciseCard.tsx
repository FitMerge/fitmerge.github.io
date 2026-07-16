import { useMemo, useState } from 'react'
import { Dumbbell, Flame, Plus, Trash2 } from 'lucide-react'
import Card from '../../components/Card'
import Button from '../../components/Button'
import NumberField from '../../components/NumberField'
import { useNutritionStore } from '../../store/nutrition'
import { useWorkoutsStore } from '../../store/workouts'
import { useBodyStore } from '../../store/body'
import { burnedCaloriesForDate, estimateSessionCalories, latestBodyWeightKg } from '../../lib/exercise'

export default function ExerciseCard({ date }: { date: string }) {
  const exerciseByDate = useNutritionStore((s) => s.exercise)
  const addExercise = useNutritionStore((s) => s.addExercise)
  const removeExercise = useNutritionStore((s) => s.removeExercise)
  const sessions = useWorkoutsStore((s) => s.sessions)
  const bodyEntries = useBodyStore((s) => s.entries)

  const bw = useMemo(() => latestBodyWeightKg(bodyEntries), [bodyEntries])
  const manual = exerciseByDate[date] ?? []
  const workoutSessions = useMemo(
    () => sessions.filter((s) => s.finishedAt && s.date === date),
    [sessions, date],
  )
  const total = useMemo(
    () => burnedCaloriesForDate(date, exerciseByDate, sessions, bw),
    [date, exerciseByDate, sessions, bw],
  )

  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [minutes, setMinutes] = useState(0)
  const [calories, setCalories] = useState(0)

  function submit() {
    if (!name.trim() || !(calories > 0)) return
    addExercise(date, {
      name: name.trim(),
      minutes: minutes > 0 ? minutes : undefined,
      calories: Math.round(calories),
    })
    setName('')
    setMinutes(0)
    setCalories(0)
    setAdding(false)
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-orange-500/15 flex items-center justify-center text-orange-400">
            <Flame size={16} />
          </div>
          <h3 className="text-sm font-semibold text-slate-200">Exercise</h3>
        </div>
        <span className="text-sm font-semibold text-orange-400">{total > 0 ? `+${total}` : '0'} kcal</span>
      </div>

      {workoutSessions.map((s) => (
        <div key={s.id} className="flex items-center gap-2 text-sm">
          <Dumbbell size={14} className="shrink-0 text-slate-500" />
          <span className="min-w-0 flex-1 truncate text-slate-300">{s.name}</span>
          <span className="text-xs text-slate-500">{estimateSessionCalories(s, bw)} kcal</span>
        </div>
      ))}

      {manual.map((e) => (
        <div key={e.id} className="flex items-center gap-2 text-sm">
          <span className="min-w-0 flex-1 truncate text-slate-300">
            {e.name}
            {e.minutes ? ` · ${e.minutes} min` : ''}
          </span>
          <span className="text-xs text-slate-500">{e.calories} kcal</span>
          <button
            type="button"
            onClick={() => removeExercise(date, e.id)}
            aria-label={`Remove ${e.name}`}
            className="w-9 h-9 rounded-md bg-slate-800 text-slate-400 flex items-center justify-center active:bg-slate-700"
          >
            <Trash2 size={13} />
          </button>
        </div>
      ))}

      {workoutSessions.length === 0 && manual.length === 0 && !adding && (
        <p className="text-xs text-slate-500">
          Log cardio or finish a workout to add calories back to your daily budget.
        </p>
      )}

      {adding ? (
        <div className="space-y-2 rounded-lg bg-slate-800/50 p-2.5">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Exercise (e.g. Running)"
            className="w-full bg-slate-900 rounded-md px-2.5 py-2 text-sm text-slate-100 outline-none focus:ring-1 focus:ring-primary-500"
          />
          <div className="grid grid-cols-2 gap-2">
            <NumberField label="Minutes" value={minutes} onChange={setMinutes} step={5} min={0} />
            <NumberField label="Calories" value={calories} onChange={setCalories} step={10} min={0} />
          </div>
          <div className="flex gap-2">
            <Button variant="primary" full disabled={!name.trim() || !(calories > 0)} onClick={submit}>
              Add
            </Button>
            <Button variant="ghost" full onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="ghost" full onClick={() => setAdding(true)}>
          <span className="flex items-center justify-center gap-1.5">
            <Plus size={15} /> Add exercise
          </span>
        </Button>
      )}
    </Card>
  )
}

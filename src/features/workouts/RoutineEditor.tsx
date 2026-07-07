import { useMemo, useState } from 'react'
import { ChevronLeft, Plus } from 'lucide-react'
import Button from '../../components/Button'
import ExercisePicker from './ExercisePicker'
import RoutineItemRow from './RoutineItemRow'
import { useWorkoutsStore } from '../../store/workouts'
import { weekdayLabels } from './utils'
import type { Exercise, RoutineItem } from '../../types'

type RoutineEditorProps = {
  routineId?: string
  onDone: () => void
  onCancel: () => void
}

export default function RoutineEditor({ routineId, onDone, onCancel }: RoutineEditorProps) {
  const routines = useWorkoutsStore((s) => s.routines)
  const addRoutine = useWorkoutsStore((s) => s.addRoutine)
  const updateRoutine = useWorkoutsStore((s) => s.updateRoutine)

  const existing = useMemo(() => routines.find((r) => r.id === routineId), [routines, routineId])

  const [name, setName] = useState(existing?.name ?? '')
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [scheduleDays, setScheduleDays] = useState<number[]>(existing?.scheduleDays ?? [])
  const [items, setItems] = useState<RoutineItem[]>(existing?.items ?? [])
  const [pickerOpen, setPickerOpen] = useState(false)

  const canSave = name.trim().length > 0 && items.length > 0

  function toggleDay(day: number) {
    setScheduleDays((days) => (days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort()))
  }

  function addExercise(exercise: Exercise) {
    setItems((prev) => [...prev, { exerciseId: exercise.id, targetSets: 3, targetReps: 10, restSec: 90 }])
  }

  function updateItem(index: number, patch: Partial<RoutineItem>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)))
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  function moveItem(index: number, dir: -1 | 1) {
    setItems((prev) => {
      const target = index + dir
      if (target < 0 || target >= prev.length) return prev
      const next = [...prev]
      const tmp = next[index]
      next[index] = next[target]
      next[target] = tmp
      return next
    })
  }

  function handleSave() {
    if (!canSave) return
    const payload = {
      name: name.trim(),
      notes: notes.trim() || undefined,
      items,
      scheduleDays: scheduleDays.length > 0 ? scheduleDays : undefined,
    }
    if (existing) {
      updateRoutine(existing.id, payload)
    } else {
      addRoutine(payload)
    }
    onDone()
  }

  return (
    <div className="p-4 pb-24 space-y-4">
      <header className="flex items-center gap-2">
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel"
          className="w-9 h-9 rounded-full bg-slate-800 active:bg-slate-700 flex items-center justify-center text-slate-300"
        >
          <ChevronLeft size={18} />
        </button>
        <h1 className="text-lg font-bold text-slate-100">{existing ? 'Edit routine' : 'New routine'}</h1>
      </header>

      <div>
        <label className="block text-sm text-slate-400 mb-1">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Push Day"
          className="w-full bg-slate-800 rounded-lg px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      <div>
        <label className="block text-sm text-slate-400 mb-1">Notes (optional)</label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Focus on tempo"
          className="w-full bg-slate-800 rounded-lg px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      <div>
        <label className="block text-sm text-slate-400 mb-1">Schedule</label>
        <div className="flex gap-2">
          {weekdayLabels().map((label, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => toggleDay(idx)}
              className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-medium ${
                scheduleDays.includes(idx) ? 'bg-primary-500 text-slate-950 font-semibold' : 'bg-slate-800 text-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-200">Exercises</h2>
        {items.length === 0 ? (
          <p className="text-sm text-slate-500">No exercises added yet.</p>
        ) : (
          <div className="space-y-2">
            {items.map((item, idx) => (
              <RoutineItemRow
                key={`${item.exerciseId}-${idx}`}
                item={item}
                isFirst={idx === 0}
                isLast={idx === items.length - 1}
                onChange={(patch) => updateItem(idx, patch)}
                onRemove={() => removeItem(idx)}
                onMoveUp={() => moveItem(idx, -1)}
                onMoveDown={() => moveItem(idx, 1)}
              />
            ))}
          </div>
        )}

        <Button variant="ghost" full onClick={() => setPickerOpen(true)}>
          <span className="flex items-center justify-center gap-1.5">
            <Plus size={16} />
            Add exercise
          </span>
        </Button>
      </div>

      <div className="space-y-2 pt-2">
        <Button variant="primary" full disabled={!canSave} onClick={handleSave}>
          Save routine
        </Button>
        <Button variant="ghost" full onClick={onCancel}>
          Cancel
        </Button>
      </div>

      <ExercisePicker open={pickerOpen} onClose={() => setPickerOpen(false)} onPick={addExercise} />
    </div>
  )
}

import { useMemo, useState } from 'react'
import { ChevronLeft, Plus, Trash2 } from 'lucide-react'
import Card from '../../components/Card'
import Button from '../../components/Button'
import { useWorkoutsStore } from '../../store/workouts'
import { uid } from '../../lib/id'
import type { ProgramDay } from '../../types'

type ProgramBuilderProps = {
  programId?: string
  onDone: () => void
}

export default function ProgramBuilder({ programId, onDone }: ProgramBuilderProps) {
  const routines = useWorkoutsStore((s) => s.routines)
  const programs = useWorkoutsStore((s) => s.programs)
  const addProgram = useWorkoutsStore((s) => s.addProgram)
  const updateProgram = useWorkoutsStore((s) => s.updateProgram)
  const removeProgram = useWorkoutsStore((s) => s.removeProgram)

  const existing = programId ? programs.find((p) => p.id === programId) : undefined

  const [name, setName] = useState(existing?.name ?? '')
  const [days, setDays] = useState<ProgramDay[]>(existing?.days ?? [])
  const [weekCount, setWeekCount] = useState(
    existing ? Math.max(1, ...existing.days.map((d) => d.week)) : 1,
  )

  const canSave = name.trim().length > 0 && days.length > 0 && routines.length > 0

  const daysByWeek = useMemo(() => {
    const map = new Map<number, ProgramDay[]>()
    for (let w = 1; w <= weekCount; w++) map.set(w, [])
    for (const d of days) {
      if (!map.has(d.week)) map.set(d.week, [])
      map.get(d.week)!.push(d)
    }
    return map
  }, [days, weekCount])

  function addDay(week: number) {
    const routine = routines[0]
    if (!routine) return
    setDays((prev) => [...prev, { id: uid(), week, name: routine.name, routineId: routine.id }])
  }

  function patchDay(id: string, patch: Partial<ProgramDay>) {
    setDays((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)))
  }

  function removeDay(id: string) {
    setDays((prev) => prev.filter((d) => d.id !== id))
  }

  function save() {
    if (!canSave) return
    const clean = days.filter((d) => d.week <= weekCount)
    if (existing) {
      updateProgram(existing.id, { name: name.trim(), days: clean })
    } else {
      addProgram({ name: name.trim(), days: clean })
    }
    onDone()
  }

  return (
    <div className="p-4 pb-24 space-y-4">
      <button
        type="button"
        onClick={onDone}
        className="flex items-center gap-1 text-sm text-slate-400 active:text-slate-200"
      >
        <ChevronLeft size={16} /> Back
      </button>

      <h1 className="text-xl font-bold text-slate-100">{existing ? 'Edit program' : 'New program'}</h1>

      <div>
        <label className="block text-sm text-slate-400 mb-1">Program name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. 8-Week Strength"
          className="w-full bg-slate-800 rounded-lg px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {routines.length === 0 && (
        <p className="text-sm text-amber-400">
          Create at least one routine first — a program is built from your routines.
        </p>
      )}

      {Array.from(daysByWeek.entries()).map(([week, weekDays]) => (
        <Card key={week} className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-200">Week {week}</h2>
          {weekDays.length === 0 && <p className="text-xs text-slate-500">No workouts yet.</p>}
          {weekDays.map((day) => (
            <div key={day.id} className="space-y-2 rounded-lg bg-slate-800/60 p-2.5">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={day.name}
                  onChange={(e) => patchDay(day.id, { name: e.target.value })}
                  placeholder="Day name"
                  className="min-w-0 flex-1 bg-slate-900 rounded-md px-2.5 py-2 text-sm text-slate-100 outline-none focus:ring-1 focus:ring-primary-500"
                />
                <button
                  type="button"
                  onClick={() => removeDay(day.id)}
                  aria-label="Remove day"
                  className="shrink-0 w-8 h-8 rounded-md bg-slate-900 text-slate-400 flex items-center justify-center active:bg-slate-700"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <select
                value={day.routineId}
                onChange={(e) => patchDay(day.id, { routineId: e.target.value })}
                className="w-full bg-slate-900 rounded-md px-2.5 py-2 text-sm text-slate-200 outline-none focus:ring-1 focus:ring-primary-500"
              >
                {routines.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          ))}
          <Button variant="ghost" full onClick={() => addDay(week)} disabled={routines.length === 0}>
            <span className="flex items-center justify-center gap-1.5">
              <Plus size={15} /> Add workout
            </span>
          </Button>
        </Card>
      ))}

      <Button variant="ghost" full onClick={() => setWeekCount((w) => w + 1)}>
        <span className="flex items-center justify-center gap-1.5">
          <Plus size={15} /> Add week
        </span>
      </Button>

      <Button variant="primary" full disabled={!canSave} onClick={save}>
        {existing ? 'Save program' : 'Create program'}
      </Button>

      {existing && (
        <Button
          variant="ghost"
          full
          onClick={() => {
            removeProgram(existing.id)
            onDone()
          }}
        >
          <span className="text-red-400">Delete program</span>
        </Button>
      )}
    </div>
  )
}

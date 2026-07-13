import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import Card from '../../components/Card'
import Sheet from '../../components/Sheet'
import Button from '../../components/Button'
import { PROGRAM_TEMPLATES, type ProgramTemplate } from '../../data/programs'
import { getExerciseById } from '../../data/exercises'
import { useWorkoutsStore } from '../../store/workouts'

type ProgramLibraryProps = {
  onBack: () => void
  onStarted: () => void
}

export default function ProgramLibrary({ onBack, onStarted }: ProgramLibraryProps) {
  const [selected, setSelected] = useState<ProgramTemplate | null>(null)
  const installProgramTemplate = useWorkoutsStore((s) => s.installProgramTemplate)

  function startProgram(template: ProgramTemplate) {
    installProgramTemplate(template)
    setSelected(null)
    onStarted()
  }

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
        <h1 className="text-lg font-bold text-slate-100">Program library</h1>
      </header>

      <p className="text-sm text-slate-400">Ready-made training plans. Tap one to preview and start in a tap.</p>

      <div className="space-y-2">
        {PROGRAM_TEMPLATES.map((template) => (
          <Card
            key={template.id}
            className="active:bg-slate-800/60"
            onClick={() => setSelected(template)}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-slate-100 truncate">{template.name}</h3>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                    {template.level}
                  </span>
                  <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-300">
                    {template.daysPerWeek} days/week
                  </span>
                  <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-300">
                    {template.weeks} weeks
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-500 line-clamp-2">{template.description}</p>
              </div>
              <ChevronRight size={18} className="mt-0.5 shrink-0 text-slate-500" />
            </div>
          </Card>
        ))}
      </div>

      <Sheet open={selected !== null} onClose={() => setSelected(null)} title={selected?.name ?? ''}>
        {selected && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-1.5">
              <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-400">
                {selected.level}
              </span>
              <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-300">
                {selected.goal}
              </span>
              <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-300">
                {selected.daysPerWeek} days/week · {selected.weeks} weeks
              </span>
            </div>

            <p className="text-sm text-slate-400">{selected.description}</p>

            <div className="space-y-3">
              {selected.routines.map((routine) => (
                <div key={routine.key} className="space-y-2">
                  <h3 className="text-sm font-semibold text-slate-100">{routine.name}</h3>
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
                </div>
              ))}
            </div>

            <Button variant="primary" full onClick={() => startProgram(selected)}>
              Start program
            </Button>
          </div>
        )}
      </Sheet>
    </div>
  )
}

import { Check } from 'lucide-react'
import NumberField from '../../components/NumberField'
import { weightUnitLabel } from './utils'
import type { SetLog, Units } from '../../types'

type SetRowProps = {
  index: number
  set: SetLog
  units: Units
  onChange: (patch: Partial<SetLog>) => void
  onCheckedOn: () => void
}

export default function SetRow({ index, set, units, onChange, onCheckedOn }: SetRowProps) {
  function toggleDone() {
    const next = !set.done
    onChange({ done: next })
    if (next) onCheckedOn()
  }

  return (
    <div className="space-y-2 py-2.5 border-b border-slate-800 last:border-0">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-400">Set {index + 1}</span>
        <button
          type="button"
          onClick={toggleDone}
          aria-label={set.done ? `Set ${index + 1} done` : `Mark set ${index + 1} done`}
          className={`w-7 h-7 rounded-full flex items-center justify-center border ${
            set.done
              ? 'bg-primary-500 border-primary-500 text-slate-950'
              : 'bg-transparent border-slate-700 text-transparent'
          }`}
        >
          <Check size={16} strokeWidth={3} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <NumberField
          label="Weight"
          value={set.weight}
          onChange={(v) => onChange({ weight: v })}
          step={2.5}
          min={0}
          suffix={weightUnitLabel(units)}
        />
        <NumberField label="Reps" value={set.reps} onChange={(v) => onChange({ reps: v })} step={1} min={0} />
      </div>
    </div>
  )
}

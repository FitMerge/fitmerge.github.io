import Card from '../../components/Card'
import { useSettingsStore } from '../../store/settings'
import type { Units } from '../../types'

const UNIT_OPTIONS: { key: Units; label: string }[] = [
  { key: 'metric', label: 'Metric (kg, cm)' },
  { key: 'imperial', label: 'Imperial (lb, in)' },
]

export default function UnitsSection() {
  const units = useSettingsStore((s) => s.units)
  const setUnits = useSettingsStore((s) => s.setUnits)

  return (
    <Card>
      <h2 className="text-sm font-semibold text-slate-200 mb-3">Units</h2>
      <div className="grid grid-cols-2 gap-2">
        {UNIT_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => setUnits(opt.key)}
            className={`rounded-full py-2 text-xs font-medium ${
              units === opt.key ? 'bg-primary-500 text-slate-950 font-semibold' : 'bg-slate-800 text-slate-300'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </Card>
  )
}

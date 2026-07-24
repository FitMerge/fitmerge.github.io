import { Check, Dumbbell } from 'lucide-react'
import Card from '../../components/Card'
import { useSettingsStore } from '../../store/settings'
import { TOGGLEABLE_EQUIPMENT } from '../../data/equipment'

/** "What equipment do I have" — drives the exercise-swap suggestions so moves you
 * can't do (e.g. cables at home) drop to the bottom or out of the list. */
export default function EquipmentSection() {
  const available = useSettingsStore((s) => s.availableEquipment)
  const setAvailableEquipment = useSettingsStore((s) => s.setAvailableEquipment)

  // undefined = no preference yet → treat everything as owned (all checked).
  const owned = available ?? TOGGLEABLE_EQUIPMENT
  const isOn = (t: string) => owned.includes(t)

  function toggle(t: string) {
    const base = available ?? [...TOGGLEABLE_EQUIPMENT]
    setAvailableEquipment(base.includes(t) ? base.filter((x) => x !== t) : [...base, t])
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-2">
        <Dumbbell size={16} className="text-primary-400" />
        <h2 className="text-sm font-semibold text-slate-200">My equipment</h2>
      </div>
      <p className="text-xs text-slate-400">
        Tick what you can train with. When you swap an exercise, comparable moves that use gear you have show first.
      </p>

      <div className="flex flex-wrap gap-2">
        {TOGGLEABLE_EQUIPMENT.map((t) => {
          const on = isOn(t)
          return (
            <button
              key={t}
              type="button"
              onClick={() => toggle(t)}
              aria-pressed={on}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${
                on ? 'bg-primary-500 text-slate-950' : 'bg-slate-800 text-slate-400'
              }`}
            >
              {on && <Check size={13} />}
              {t}
            </button>
          )
        })}
      </div>
      <p className="text-[11px] text-slate-500">Bodyweight is always available.</p>
    </Card>
  )
}

import Card from '../../components/Card'
import NumberField from '../../components/NumberField'
import { useSettingsStore } from '../../store/settings'
import type { Activity, Sex } from '../../types'
import { cmToIn, inToCm } from './utils'

const SEX_OPTIONS: Sex[] = ['male', 'female']

const ACTIVITY_OPTIONS: { key: Activity; label: string }[] = [
  { key: 'sedentary', label: 'Sedentary' },
  { key: 'light', label: 'Light' },
  { key: 'moderate', label: 'Moderate' },
  { key: 'active', label: 'Active' },
  { key: 'very', label: 'Very active' },
]

export default function ProfileSection() {
  const profile = useSettingsStore((s) => s.profile)
  const units = useSettingsStore((s) => s.units)
  const setProfile = useSettingsStore((s) => s.setProfile)

  const heightLabel = units === 'imperial' ? 'Height (in)' : 'Height (cm)'
  // Whole inches / whole cm so the +/- stepper round-trips cleanly (a net-zero
  // tap must not drift the stored height via inch↔cm rounding).
  const heightValue = profile.heightCm
    ? Math.round(units === 'imperial' ? cmToIn(profile.heightCm) : profile.heightCm)
    : 0

  function handleHeightChange(value: number) {
    setProfile({ heightCm: Math.round(units === 'imperial' ? inToCm(value) : value) })
  }

  return (
    <Card className="space-y-4">
      <h2 className="text-sm font-semibold text-slate-200">Profile</h2>

      <div>
        <label className="block text-sm text-slate-400 mb-1">Name</label>
        <input
          type="text"
          value={profile.name ?? ''}
          onChange={(e) => setProfile({ name: e.target.value })}
          placeholder="Your name"
          className="w-full bg-slate-800 rounded-lg px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      <div>
        <label className="block text-sm text-slate-400 mb-1">Sex</label>
        <div className="grid grid-cols-2 gap-2">
          {SEX_OPTIONS.map((sex) => (
            <button
              key={sex}
              type="button"
              onClick={() => setProfile({ sex })}
              className={`rounded-full py-1.5 text-xs capitalize ${
                profile.sex === sex ? 'bg-primary-500 text-slate-950 font-semibold' : 'bg-slate-800 text-slate-300'
              }`}
            >
              {sex}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <NumberField label="Age" value={profile.age ?? 0} onChange={(age) => setProfile({ age })} step={1} min={0} />
        <NumberField
          label={heightLabel}
          value={heightValue}
          onChange={handleHeightChange}
          step={1}
          min={0}
        />
      </div>

      <div>
        <label className="block text-sm text-slate-400 mb-1">Activity level</label>
        <div className="grid grid-cols-3 gap-2">
          {ACTIVITY_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setProfile({ activity: opt.key })}
              className={`rounded-full py-1.5 text-xs text-center ${
                profile.activity === opt.key
                  ? 'bg-primary-500 text-slate-950 font-semibold'
                  : 'bg-slate-800 text-slate-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </Card>
  )
}

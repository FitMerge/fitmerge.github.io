import { useMemo, useState } from 'react'
import { Dumbbell, Camera, ScanBarcode, ListChecks } from 'lucide-react'
import Card from '../../components/Card'
import Button from '../../components/Button'
import NumberField from '../../components/NumberField'
import { useSettingsStore } from '../../store/settings'
import { useBodyStore } from '../../store/body'
import { bmr, suggestGoals, tdee } from '../../lib/tdee'
import { todayISO } from '../../lib/date'
import { cmToInch, inchToCm, kgToLb, lbToKg, weightUnit } from '../../lib/units'
import type { Activity, Sex } from '../../types'

const SEX_OPTIONS: Sex[] = ['male', 'female']

const ACTIVITY_OPTIONS: { key: Activity; label: string }[] = [
  { key: 'sedentary', label: 'Sedentary' },
  { key: 'light', label: 'Light' },
  { key: 'moderate', label: 'Moderate' },
  { key: 'active', label: 'Active' },
  { key: 'very', label: 'Very active' },
]

type GoalType = 'lose' | 'maintain' | 'gain'

const GOAL_TYPE_OPTIONS: { key: GoalType; label: string }[] = [
  { key: 'lose', label: 'Lose' },
  { key: 'maintain', label: 'Maintain' },
  { key: 'gain', label: 'Gain' },
]

const TOTAL_STEPS = 3

export default function OnboardingWizard() {
  const profile = useSettingsStore((s) => s.profile)
  const setProfile = useSettingsStore((s) => s.setProfile)
  const setGoals = useSettingsStore((s) => s.setGoals)
  const setOnboarded = useSettingsStore((s) => s.setOnboarded)
  const units = useSettingsStore((s) => s.units)
  const upsertEntry = useBodyStore((s) => s.upsertEntry)

  const [step, setStep] = useState(1)
  const [sex, setSex] = useState<Sex>(profile.sex ?? 'male')
  const [age, setAge] = useState<number>(profile.age ?? 0)
  const [heightCm, setHeightCm] = useState<number>(profile.heightCm ?? 0)
  const [weightKg, setWeightKg] = useState<number>(75)
  const [activity, setActivity] = useState<Activity>(profile.activity ?? 'moderate')
  const [goalType, setGoalType] = useState<GoalType>(profile.goalType ?? 'maintain')
  const [calorieOverride, setCalorieOverride] = useState<number | null>(null)

  const localProfile = useMemo(
    () => ({ sex, age: age || undefined, heightCm: heightCm || undefined, activity }),
    [sex, age, heightCm, activity],
  )
  const bmrVal = useMemo(() => bmr(localProfile, weightKg), [localProfile, weightKg])
  const tdeeVal = useMemo(() => tdee(bmrVal, activity), [bmrVal, activity])
  const baseGoals = useMemo(() => suggestGoals(tdeeVal, goalType, weightKg), [tdeeVal, goalType, weightKg])

  const calories = calorieOverride ?? baseGoals.calories
  const delta = calories - baseGoals.calories
  const finalGoals = {
    calories,
    protein: baseGoals.protein,
    fat: baseGoals.fat,
    carbs: Math.max(0, Math.round(baseGoals.carbs + delta / 4)),
  }

  function skip() {
    setOnboarded(true)
  }

  function finish() {
    setProfile({ sex, age: age || undefined, heightCm: heightCm || undefined, activity, goalType })
    setGoals(finalGoals)
    upsertEntry({ date: todayISO(), weightKg })
    setOnboarded(true)
  }

  function selectActivity(next: Activity) {
    setActivity(next)
    setCalorieOverride(null)
  }

  function selectGoalType(next: GoalType) {
    setGoalType(next)
    setCalorieOverride(null)
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 overflow-y-auto overscroll-contain">
      <div className="max-w-md mx-auto min-h-full flex flex-col safe-screen">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-1.5">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((dot) => (
              <span
                key={dot}
                className={`h-1.5 rounded-full transition-all ${
                  dot === step ? 'w-6 bg-emerald-400' : 'w-1.5 bg-slate-700'
                }`}
              />
            ))}
          </div>
          <button type="button" onClick={skip} className="text-sm text-slate-400 active:text-slate-200">
            Skip
          </button>
        </div>

        <div className="flex-1 flex flex-col">
          {step === 1 && (
            <div className="flex-1 flex flex-col items-center text-center gap-6 pt-8">
              <div className="w-20 h-20 rounded-full bg-emerald-500/15 flex items-center justify-center text-emerald-400">
                <Dumbbell size={36} />
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-bold text-slate-100">Welcome to Rung</h1>
                <p className="text-sm text-slate-400">
                  Training, food and recovery — finally in one place.
                </p>
              </div>

              <div className="w-full space-y-3 text-left">
                <div className="flex items-center gap-3 rounded-xl bg-slate-900 border border-slate-800 p-3">
                  <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-emerald-400 shrink-0">
                    <Camera size={18} />
                  </div>
                  <p className="text-sm text-slate-200">Snap a photo to log macros instantly</p>
                </div>
                <div className="flex items-center gap-3 rounded-xl bg-slate-900 border border-slate-800 p-3">
                  <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-emerald-400 shrink-0">
                    <ScanBarcode size={18} />
                  </div>
                  <p className="text-sm text-slate-200">Barcode scan or search thousands of foods</p>
                </div>
                <div className="flex items-center gap-3 rounded-xl bg-slate-900 border border-slate-800 p-3">
                  <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-emerald-400 shrink-0">
                    <ListChecks size={18} />
                  </div>
                  <p className="text-sm text-slate-200">Build custom workout routines and track sessions</p>
                </div>
              </div>

              <div className="flex-1" />
              <Button variant="primary" full onClick={() => setStep(2)}>
                Get started
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="flex-1 flex flex-col gap-4 pt-4">
              <div>
                <h2 className="text-xl font-bold text-slate-100">About you</h2>
                <p className="text-sm text-slate-400">We&apos;ll use this to personalize your goals.</p>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Sex</label>
                <div className="grid grid-cols-2 gap-2">
                  {SEX_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setSex(opt)}
                      className={`rounded-full py-1.5 text-xs capitalize ${
                        sex === opt ? 'bg-primary-500 text-slate-950 font-semibold' : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <NumberField label="Age" value={age} onChange={setAge} step={1} min={0} />
                <NumberField
                  label={units === 'imperial' ? 'Height (in)' : 'Height (cm)'}
                  value={units === 'imperial' ? Math.round(cmToInch(heightCm)) : heightCm}
                  onChange={(v) => setHeightCm(units === 'imperial' ? inchToCm(v) : v)}
                  step={1}
                  min={0}
                />
              </div>

              <NumberField
                label={`Weight (${weightUnit(units)})`}
                value={units === 'imperial' ? Math.round(kgToLb(weightKg) * 10) / 10 : weightKg}
                onChange={(v) => setWeightKg(units === 'imperial' ? lbToKg(v) : v)}
                step={0.5}
                min={0}
              />

              <div className="flex-1" />
              <Button variant="primary" full disabled={!(weightKg > 0)} onClick={() => setStep(3)}>
                Continue
              </Button>
            </div>
          )}

          {step === 3 && (
            <div className="flex-1 flex flex-col gap-4 pt-4">
              <div>
                <h2 className="text-xl font-bold text-slate-100">Your goals</h2>
                <p className="text-sm text-slate-400">Pick your activity level and goal.</p>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Activity level</label>
                <div className="grid grid-cols-3 gap-2">
                  {ACTIVITY_OPTIONS.map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => selectActivity(opt.key)}
                      className={`rounded-full py-1.5 text-xs text-center ${
                        activity === opt.key
                          ? 'bg-primary-500 text-slate-950 font-semibold'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Goal</label>
                <div className="grid grid-cols-3 gap-2">
                  {GOAL_TYPE_OPTIONS.map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => selectGoalType(opt.key)}
                      className={`rounded-full py-1.5 text-xs font-medium ${
                        goalType === opt.key
                          ? 'bg-primary-500 text-slate-950 font-semibold'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <Card className="space-y-3">
                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Suggested goals</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-slate-500">BMR</p>
                    <p className="text-lg font-bold text-slate-100">{Math.round(bmrVal)} kcal</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">TDEE</p>
                    <p className="text-lg font-bold text-slate-100">{Math.round(tdeeVal)} kcal</p>
                  </div>
                </div>
                <NumberField
                  label="Daily calories"
                  value={calories}
                  onChange={(v) => setCalorieOverride(v)}
                  step={50}
                  min={0}
                />
                <p className="text-xs text-slate-400">
                  {finalGoals.calories.toLocaleString()} kcal · {finalGoals.protein}P · {finalGoals.carbs}C ·{' '}
                  {finalGoals.fat}F
                </p>
              </Card>

              <div className="flex-1" />
              <Button variant="primary" full onClick={finish}>
                Finish
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

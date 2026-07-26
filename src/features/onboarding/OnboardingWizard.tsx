import { useMemo, useState } from 'react'
import { Dumbbell, Camera, ScanBarcode, ListChecks, Watch, Apple, Activity as ActivityIcon, PencilLine } from 'lucide-react'
import Card from '../../components/Card'
import Button from '../../components/Button'
import NumberField from '../../components/NumberField'
import GarminConnectSection from '../settings/GarminConnectSection'
import { useSettingsStore, type TrackingSource } from '../../store/settings'
import { useBodyStore } from '../../store/body'
import { useAuth } from '../../auth/AuthProvider'
import { bmr, suggestGoals, tdee } from '../../lib/tdee'
import { todayISO } from '../../lib/date'
import { cmToInch, inchToCm, kgToLb, lbToKg, weightUnit } from '../../lib/units'
import type { Activity, Sex } from '../../types'

const SOURCE_OPTIONS: { key: TrackingSource; label: string; sub: string; icon: typeof Watch }[] = [
  { key: 'garmin', label: 'Garmin watch', sub: 'Syncs on its own', icon: Watch },
  { key: 'apple', label: 'Apple Watch', sub: 'Import from Health', icon: Apple },
  { key: 'other', label: 'Fitbit, Oura, Whoop…', sub: 'Import a file', icon: ActivityIcon },
  { key: 'manual', label: 'No watch', sub: 'Log it yourself', icon: PencilLine },
]

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

const TOTAL_STEPS = 4

export default function OnboardingWizard() {
  const profile = useSettingsStore((s) => s.profile)
  const setProfile = useSettingsStore((s) => s.setProfile)
  const setGoals = useSettingsStore((s) => s.setGoals)
  const setOnboarded = useSettingsStore((s) => s.setOnboarded)
  const setTrackingSource = useSettingsStore((s) => s.setTrackingSource)
  const units = useSettingsStore((s) => s.units)
  const upsertEntry = useBodyStore((s) => s.upsertEntry)
  const { status: authStatus, signIn } = useAuth()

  const [step, setStep] = useState(1)
  const [sex, setSex] = useState<Sex>(profile.sex ?? 'male')
  const [age, setAge] = useState<number>(profile.age ?? 0)
  const [heightCm, setHeightCm] = useState<number>(profile.heightCm ?? 0)
  const [weightKg, setWeightKg] = useState<number>(75)
  const [activity, setActivity] = useState<Activity>(profile.activity ?? 'moderate')
  const [goalType, setGoalType] = useState<GoalType>(profile.goalType ?? 'maintain')
  const [calorieOverride, setCalorieOverride] = useState<number | null>(null)
  const [source, setSource] = useState<TrackingSource | null>(null)

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

  /** Persist profile + goals when leaving the goals step, so nothing is lost if
   * they skip out of the last step. */
  function saveGoalsAndContinue() {
    setProfile({ sex, age: age || undefined, heightCm: heightCm || undefined, activity, goalType })
    setGoals(finalGoals)
    upsertEntry({ date: todayISO(), weightKg })
    setStep(4)
  }

  function finish() {
    if (source) setTrackingSource(source)
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
                <h1 className="text-2xl font-bold text-slate-100">Welcome to FitMerge</h1>
                <p className="text-sm text-slate-400">
                  Track meals, macros and workouts — all in one place.
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
              <Button variant="primary" full onClick={saveGoalsAndContinue}>
                Continue
              </Button>
            </div>
          )}

          {step === 4 && (
            <div className="flex-1 flex flex-col gap-4 pt-4">
              <div>
                <h2 className="text-xl font-bold text-slate-100">How do you track?</h2>
                <p className="text-sm text-slate-400">
                  So the app sets itself up for your gear — you can change this later.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {SOURCE_OPTIONS.map((opt) => {
                  const Icon = opt.icon
                  const active = source === opt.key
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setSource(opt.key)}
                      className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left ${
                        active ? 'border-primary-500 bg-primary-500/10' : 'border-slate-800 bg-slate-900'
                      }`}
                    >
                      <Icon size={20} className={active ? 'text-primary-400' : 'text-slate-400'} />
                      <span className="text-sm font-medium text-slate-100">{opt.label}</span>
                      <span className="text-[11px] text-slate-500">{opt.sub}</span>
                    </button>
                  )
                })}
              </div>

              {/* Garmin is the one source that can connect right here — the rest are
                  file imports or manual entry, so we just set expectations. */}
              {source === 'garmin' &&
                (authStatus === 'signed-in' ? (
                  <GarminConnectSection />
                ) : (
                  <Card className="space-y-2">
                    <p className="text-sm text-slate-300">Sign in first, then connect your watch.</p>
                    <p className="text-xs text-slate-500">
                      Signing in keeps your data on all your devices — and is what lets the watch sync run in the
                      cloud.
                    </p>
                    <Button variant="primary" full onClick={() => void signIn()}>
                      {authStatus === 'signing-in' ? 'Signing in…' : 'Sign in with Google'}
                    </Button>
                  </Card>
                ))}

              {source === 'apple' && (
                <Card className="space-y-1.5">
                  <p className="text-sm text-slate-300">Bring your Apple Watch data over</p>
                  <p className="text-xs text-slate-400">
                    In the Health app: tap your photo → Export All Health Data, then import the zip from Settings →
                    Connect health data. Weight and workouts come across.
                  </p>
                </Card>
              )}

              {source === 'other' && (
                <Card className="space-y-1.5">
                  <p className="text-sm text-slate-300">Import from your app</p>
                  <p className="text-xs text-slate-400">
                    Export a CSV or JSON from Fitbit, Oura or Whoop, then load it in Settings → Connect health data.
                  </p>
                </Card>
              )}

              {source === 'manual' && (
                <Card className="space-y-1.5">
                  <p className="text-sm text-slate-300">No watch needed</p>
                  <p className="text-xs text-slate-400">
                    Everything else works the same — meals, workouts, water and weight. You can log sleep and steps
                    by hand from the + button, and the health charts fill in from those.
                  </p>
                </Card>
              )}

              <div className="flex-1" />
              <Button variant="primary" full disabled={!source} onClick={finish}>
                {source === 'garmin' || source === 'apple' ? 'Done' : 'Start tracking'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

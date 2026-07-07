import { useMemo, useState } from 'react'
import Button from '../../components/Button'
import { useBodyStore } from '../../store/body'
import { useSettingsStore } from '../../store/settings'
import { bmr, suggestGoals, tdee } from '../../lib/tdee'
import { lastNEntries } from '../progress/utils'
import type { Goals, Profile } from '../../types'

type GoalType = NonNullable<Profile['goalType']>

const GOAL_TYPE_OPTIONS: { key: GoalType; label: string }[] = [
  { key: 'lose', label: 'Lose' },
  { key: 'maintain', label: 'Maintain' },
  { key: 'gain', label: 'Gain' },
]

const DEFAULT_WEIGHT_KG = 75

type TdeeCardProps = {
  onApply: (goals: Goals) => void
}

export default function TdeeCard({ onApply }: TdeeCardProps) {
  const profile = useSettingsStore((s) => s.profile)
  const setProfile = useSettingsStore((s) => s.setProfile)
  const bodyEntries = useBodyStore((s) => s.entries)

  const [goalType, setGoalType] = useState<GoalType>(profile.goalType ?? 'maintain')

  const latestEntry = useMemo(() => lastNEntries(bodyEntries, 1)[0], [bodyEntries])
  const weightKg = latestEntry?.weightKg ?? DEFAULT_WEIGHT_KG

  const bmrVal = useMemo(() => bmr(profile, weightKg), [profile, weightKg])
  const tdeeVal = useMemo(() => tdee(bmrVal, profile.activity), [bmrVal, profile.activity])
  const suggestion = useMemo(() => suggestGoals(tdeeVal, goalType, weightKg), [tdeeVal, goalType, weightKg])

  function selectGoalType(next: GoalType) {
    setGoalType(next)
    setProfile({ goalType: next })
  }

  return (
    <div className="rounded-xl bg-slate-800/60 p-3 space-y-3">
      <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wide">TDEE calculator</h3>

      {!latestEntry && (
        <p className="text-xs text-amber-400">using default 75 kg — log a weigh-in for a more accurate estimate</p>
      )}

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

      <div className="grid grid-cols-3 gap-2">
        {GOAL_TYPE_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => selectGoalType(opt.key)}
            className={`rounded-full py-1.5 text-xs font-medium ${
              goalType === opt.key ? 'bg-primary-500 text-slate-950 font-semibold' : 'bg-slate-900 text-slate-300'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <p className="text-xs text-slate-400">
        {suggestion.calories.toLocaleString()} kcal · {suggestion.protein}P · {suggestion.carbs}C · {suggestion.fat}F
      </p>

      <Button variant="ghost" full onClick={() => onApply(suggestion)}>
        Apply suggested goals
      </Button>
    </div>
  )
}

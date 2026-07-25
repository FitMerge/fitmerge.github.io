import { useMemo } from 'react'
import { Trophy } from 'lucide-react'
import Card from '../../components/Card'
import { useWorkoutsStore } from '../../store/workouts'
import { useSettingsStore } from '../../store/settings'
import { getExerciseById } from '../../data/exercises'
import { weightUnitLabel } from '../workouts/utils'
import { personalRecords } from './utils'

export default function PersonalRecordsSection() {
  const sessions = useWorkoutsStore((s) => s.sessions)
  const units = useSettingsStore((s) => s.units)
  const unitLabel = weightUnitLabel(units)

  const records = useMemo(() => personalRecords(sessions), [sessions])

  return (
    <Card>
      <h2 className="text-sm font-semibold text-slate-200 mb-2">Personal records</h2>
      {records.length === 0 ? (
        <div className="py-2">
          <p className="text-sm text-slate-500">
            Finish a workout with completed sets to see your personal records here.
          </p>
          <p className="mt-1 text-[11px] text-slate-600">These come from strength sets you log in the app. Your imported Garmin run records show under Cardio.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {records.map((pr, index) => {
            const exercise = getExerciseById(pr.exerciseId)
            return (
              <div key={pr.exerciseId} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-amber-400 shrink-0">
                  {index === 0 ? <Trophy size={15} /> : <span className="text-xs font-semibold">{index + 1}</span>}
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-slate-100 truncate">
                    {exercise?.name ?? pr.exerciseId} — {pr.est1RM.toFixed(1)} {unitLabel} est. 1RM
                  </p>
                  <p className="text-xs text-slate-500">
                    {pr.weight} {unitLabel} × {pr.reps}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

import { useMemo, useState } from 'react'
import { ChevronRight, Trophy } from 'lucide-react'
import Card from '../../components/Card'
import { useWorkoutsStore } from '../../store/workouts'
import { useSettingsStore } from '../../store/settings'
import { getExerciseById } from '../../data/exercises'
import { addDays, todayISO } from '../../lib/date'
import { weightUnitLabel } from '../workouts/utils'
import { monthDayLabel, personalRecords } from './utils'

/** A record set within this many days still counts as news. */
const FRESH_DAYS = 14
const COLLAPSED = 5

type Props = {
  /** Tapping a record charts that lift at the top of the page, rather than
   * opening a second chart in a sheet on top of the one already on screen. */
  onSelectExercise: (id: string) => void
}

export default function PersonalRecordsSection({ onSelectExercise }: Props) {
  const sessions = useWorkoutsStore((s) => s.sessions)
  const units = useSettingsStore((s) => s.units)
  const unitLabel = weightUnitLabel(units)
  const [expanded, setExpanded] = useState(false)

  const records = useMemo(() => personalRecords(sessions), [sessions])
  const freshFrom = addDays(todayISO(), -(FRESH_DAYS - 1))
  const shown = expanded ? records : records.slice(0, COLLAPSED)

  return (
    <Card>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-200">Personal records</h2>
        <span className="text-[10px] text-slate-500">newest first</span>
      </div>
      {/* Ordering by date, not by weight, is what makes this card worth opening:
          ranked by weight it was a permanent list of your five biggest lifts. */}
      <p className="mb-2.5 text-[11px] text-slate-500">
        Your best estimated 1RM for each exercise, most recently set first — the one place a
        formula is used, because it is the only fair way to compare a heavy triple with a set of
        ten. Tap one to chart that lift above.
      </p>

      {records.length === 0 ? (
        <div className="py-2">
          <p className="text-sm text-slate-500">
            Finish a workout with completed sets to see your personal records here.
          </p>
          <p className="mt-1 text-[11px] text-slate-600">
            These come from strength sets you log in the app. Your imported Garmin run records show
            under Cardio.
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {shown.map((pr) => {
            const exercise = getExerciseById(pr.exerciseId)
            const fresh = pr.date >= freshFrom
            return (
              <button
                key={pr.exerciseId}
                type="button"
                onClick={() => onSelectExercise(pr.exerciseId)}
                className="flex w-full items-center gap-3 rounded-lg px-1.5 py-1.5 text-left active:bg-slate-800"
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    fresh ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-500'
                  }`}
                >
                  <Trophy size={15} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm text-slate-100">
                      {exercise?.name ?? pr.exerciseId}
                    </span>
                    {fresh && (
                      <span className="shrink-0 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-300">
                        New
                      </span>
                    )}
                  </span>
                  <span className="block text-xs text-slate-500">
                    {pr.weight} {unitLabel} × {pr.reps} · {monthDayLabel(pr.date)}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-sm font-semibold text-slate-100 tabular-nums">
                    {pr.est1RM.toFixed(1)} {unitLabel}
                  </span>
                  <span className="block text-[10px] text-slate-500">est. 1RM</span>
                </span>
                <ChevronRight size={14} className="shrink-0 text-slate-600" />
              </button>
            )
          })}

          {records.length > COLLAPSED && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="w-full pt-1.5 text-center text-[11px] font-medium text-slate-400"
            >
              {expanded ? 'Show less' : `Show all ${records.length}`}
            </button>
          )}
        </div>
      )}

    </Card>
  )
}

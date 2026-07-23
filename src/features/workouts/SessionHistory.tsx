import { useMemo, useState } from 'react'
import { ChevronLeft, History } from 'lucide-react'
import Card from '../../components/Card'
import EmptyState from '../../components/EmptyState'
import SessionDetail from './SessionDetail'
import { useWorkoutsStore } from '../../store/workouts'
import { useSettingsStore } from '../../store/settings'
import { isoToLabel } from '../../lib/date'
import { distanceUnitLabel, isCardioSession } from './cardio'
import {
  formatDurationMin,
  monthYearLabel,
  sessionDurationMs,
  totalSetsDone,
  totalVolume,
  weightUnitLabel,
} from './utils'
import type { Units, WorkoutSession } from '../../types'

type HistoryFilter = 'all' | 'lifting' | 'cardio'

const FILTERS: { key: HistoryFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'lifting', label: 'Lifting' },
  { key: 'cardio', label: 'Cardio' },
]

const KM_PER_MILE = 1.60934

type SessionHistoryProps = {
  onBack: () => void
  /** Called after a session is repeated, so the parent can switch to the active session view. */
  onRepeated: () => void
}

export default function SessionHistory({ onBack, onRepeated }: SessionHistoryProps) {
  const sessions = useWorkoutsStore((s) => s.sessions)
  const units = useSettingsStore((s) => s.units)
  const unitLabel = weightUnitLabel(units)
  const [selected, setSelected] = useState<WorkoutSession | null>(null)
  const [filter, setFilter] = useState<HistoryFilter>('all')

  const finished = useMemo(
    () =>
      sessions
        .filter((s) => s.finishedAt !== undefined)
        .filter((s) =>
          filter === 'all' ? true : filter === 'cardio' ? isCardioSession(s) : !isCardioSession(s),
        )
        .sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0)),
    [sessions, filter],
  )

  const groups = useMemo(() => {
    const map = new Map<string, WorkoutSession[]>()
    for (const session of finished) {
      const key = monthYearLabel(session.date)
      const list = map.get(key)
      if (list) list.push(session)
      else map.set(key, [session])
    }
    return Array.from(map.entries())
  }, [finished])

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
        <h1 className="text-lg font-bold text-slate-100">History</h1>
      </header>

      <div className="flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`flex-1 rounded-full py-1.5 text-xs font-medium ${
              filter === f.key ? 'bg-slate-700 text-slate-100' : 'bg-slate-800 text-slate-400'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {finished.length === 0 ? (
        <EmptyState
          icon={History}
          title={filter === 'all' ? 'No workouts yet' : `No ${filter} sessions yet`}
          subtitle={filter === 'all' ? 'Finish your first workout to see it here.' : 'Try another filter.'}
        />
      ) : (
        <div className="space-y-5">
          {groups.map(([label, groupSessions]) => (
            <section key={label} className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</h2>
              <div className="space-y-2">
                {groupSessions.map((session) => {
                  const durationMs = sessionDurationMs(session)
                  return (
                    <Card
                      key={session.id}
                      className="active:bg-slate-800/60"
                      onClick={() => setSelected(session)}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium text-slate-100 truncate">{session.name}</p>
                            {session.imported && (
                              <span className="shrink-0 rounded-full bg-slate-700 px-1.5 py-0.5 text-[10px] font-medium text-slate-300">
                                Imported
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500">
                            {isoToLabel(session.date)} · {formatDurationMin(durationMs)}
                          </p>
                        </div>
                        <SessionStats session={session} unitLabel={unitLabel} units={units} />
                      </div>
                    </Card>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <SessionDetail
        session={selected}
        onClose={() => setSelected(null)}
        onRepeated={() => {
          setSelected(null)
          onRepeated()
        }}
      />
    </div>
  )
}

/** Right-hand stats: sets + volume for lifts, distance + calories for cardio. */
function SessionStats({ session, unitLabel, units }: { session: WorkoutSession; unitLabel: string; units: Units }) {
  if (isCardioSession(session)) {
    const km = session.distanceKm ?? 0
    const dist = units === 'imperial' ? km / KM_PER_MILE : km
    return (
      <div className="text-right shrink-0">
        <p className="text-sm text-slate-200">
          {km > 0 ? `${dist.toFixed(1)} ${distanceUnitLabel(units)}` : `${session.durationMin ?? 0} min`}
        </p>
        <p className="text-xs text-slate-500">{session.kcal ? `${session.kcal} kcal` : 'cardio'}</p>
      </div>
    )
  }
  return (
    <div className="text-right shrink-0">
      <p className="text-sm text-slate-200">{totalSetsDone(session)} sets</p>
      <p className="text-xs text-slate-500">
        {Math.round(totalVolume(session)).toLocaleString()} {unitLabel}
      </p>
    </div>
  )
}

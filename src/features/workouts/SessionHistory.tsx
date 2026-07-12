import { useMemo, useState } from 'react'
import { ChevronLeft, History } from 'lucide-react'
import Card from '../../components/Card'
import EmptyState from '../../components/EmptyState'
import SessionDetail from './SessionDetail'
import { useWorkoutsStore } from '../../store/workouts'
import { useSettingsStore } from '../../store/settings'
import { isoToLabel } from '../../lib/date'
import { formatDurationMin, monthYearLabel, totalSetsDone, totalVolume, weightUnitLabel } from './utils'
import type { WorkoutSession } from '../../types'

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

  const finished = useMemo(
    () =>
      sessions
        .filter((s) => s.finishedAt !== undefined)
        .sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0)),
    [sessions],
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

      {finished.length === 0 ? (
        <EmptyState icon={History} title="No workouts yet" subtitle="Finish your first workout to see it here." />
      ) : (
        <div className="space-y-5">
          {groups.map(([label, groupSessions]) => (
            <section key={label} className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</h2>
              <div className="space-y-2">
                {groupSessions.map((session) => {
                  const durationMs = (session.finishedAt ?? session.startedAt) - session.startedAt
                  return (
                    <Card
                      key={session.id}
                      className="active:bg-slate-800/60"
                      onClick={() => setSelected(session)}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-100 truncate">{session.name}</p>
                          <p className="text-xs text-slate-500">
                            {isoToLabel(session.date)} · {formatDurationMin(durationMs)}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm text-slate-200">{totalSetsDone(session)} sets</p>
                          <p className="text-xs text-slate-500">
                            {Math.round(totalVolume(session)).toLocaleString()} {unitLabel}
                          </p>
                        </div>
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

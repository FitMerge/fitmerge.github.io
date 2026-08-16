// The last few workouts, on the Workouts home.
//
// History was a nav row showing only a count, so "what did I lift last time?" —
// the question you have most often, standing in a gym — took a tap into a
// separate screen and a scroll. Each row names the exercises and their top set,
// because a date and a tonnage total do not tell you what to load the bar with.

import { useMemo, useState } from 'react'
import { ChevronRight, History } from 'lucide-react'
import Card from '../../components/Card'
import SessionDetail from './SessionDetail'
import { useWorkoutsStore } from '../../store/workouts'
import { useSettingsStore } from '../../store/settings'
import { getExerciseById } from '../../data/exercises'
import { addDays, todayISO } from '../../lib/date'
import { isCardioSession } from './cardio'
import { isWorkingSet, totalSetsDone, weightUnitLabel } from './utils'
import type { WorkoutSession } from '../../types'

const SHOWN = 4

/** "Bench 185lb×5 · Row 135lb×8" — the top set of each exercise, heaviest first. */
function topSetSummary(session: WorkoutSession, unitLabel: string): string {
  const tops: { name: string; weight: number; reps: number }[] = []
  for (const entry of session.entries) {
    let best: { weight: number; reps: number } | null = null
    for (const set of entry.sets) {
      if (!isWorkingSet(set)) continue
      if (!best || set.weight > best.weight) best = { weight: set.weight, reps: set.reps }
    }
    if (!best) continue
    tops.push({ name: getExerciseById(entry.exerciseId)?.name ?? entry.exerciseId, ...best })
  }
  return tops
    .sort((a, b) => b.weight - a.weight)
    .map((p) => `${p.name} ${p.weight}${unitLabel}×${p.reps}`)
    .join(' · ')
}

function dayLabel(iso: string): string {
  const today = todayISO()
  if (iso === today) return 'Today'
  if (iso === addDays(today, -1)) return 'Yesterday'
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

type Props = {
  onSeeAll: () => void
  onRepeated: () => void
}

export default function RecentWorkoutsCard({ onSeeAll, onRepeated }: Props) {
  const sessions = useWorkoutsStore((s) => s.sessions)
  const units = useSettingsStore((s) => s.units)
  const unitLabel = weightUnitLabel(units)
  const [openSession, setOpenSession] = useState<WorkoutSession | null>(null)

  const recent = useMemo(
    () =>
      sessions
        .filter((s) => s.finishedAt !== undefined && !isCardioSession(s))
        .sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0))
        .slice(0, SHOWN),
    [sessions],
  )

  if (recent.length === 0) return null

  return (
    <Card className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <History size={15} className="text-primary-400" />
          <h2 className="text-sm font-semibold text-slate-200">Recent workouts</h2>
        </div>
        <button
          type="button"
          onClick={onSeeAll}
          className="text-xs font-medium text-emerald-400 active:text-emerald-300"
        >
          See all
        </button>
      </div>

      <div className="space-y-1">
        {recent.map((s) => {
          const summary = topSetSummary(s, unitLabel)
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setOpenSession(s)}
              className="flex w-full items-center gap-2 rounded-lg bg-slate-800/40 px-2.5 py-2 text-left active:bg-slate-800"
            >
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-1.5">
                  <span className="truncate text-xs font-medium text-slate-100">{s.name}</span>
                  <span className="shrink-0 text-[10px] text-slate-500">
                    {dayLabel(s.date)}
                  </span>
                </span>
                {/* The actual lifts. Without these the row is just a timestamp. */}
                <span className="mt-0.5 block truncate text-[11px] text-slate-400">
                  {summary || `${totalSetsDone(s)} sets`}
                </span>
              </span>
              <ChevronRight size={14} className="shrink-0 text-slate-600" />
            </button>
          )
        })}
      </div>

      <SessionDetail
        session={openSession}
        onClose={() => setOpenSession(null)}
        onRepeated={() => {
          setOpenSession(null)
          onRepeated()
        }}
      />
    </Card>
  )
}

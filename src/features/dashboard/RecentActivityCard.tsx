import { useNavigate } from 'react-router-dom'
import { Activity, Bike, ChevronRight, Dumbbell, Footprints, Mountain, Snowflake } from 'lucide-react'
import Card from '../../components/Card'
import { addDays, todayISO } from '../../lib/date'
import type { ActivityCategory } from '../workouts/cardio'
import type { RecentActivity } from './homeData'

const CATEGORY_ICON: Record<ActivityCategory, typeof Activity> = {
  Run: Footprints,
  Walk: Footprints,
  Hike: Mountain,
  Bike: Bike,
  Ski: Snowflake,
  Strength: Dumbbell,
  Other: Activity,
}

/** "Today" / "Yesterday" / weekday, matching the recent-workouts list. */
function dayLabel(iso: string): string {
  const today = todayISO()
  if (iso === today) return 'Today'
  if (iso === addDays(today, -1)) return 'Yesterday'
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short' })
}

/**
 * The last few things you did — runs, hikes, workouts, yoga — on Home, so cardio
 * and one-off activities aren't buried three taps deep on the Train tab. Tapping
 * through goes to Train.
 */
export default function RecentActivityCard({ activities }: { activities: RecentActivity[] }) {
  const navigate = useNavigate()
  if (activities.length === 0) return null

  return (
    <Card className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-100">Recent activity</h2>
        <button
          type="button"
          onClick={() => navigate('/workouts')}
          className="text-xs font-medium text-emerald-400 active:text-emerald-300"
        >
          See all
        </button>
      </div>
      <div className="space-y-1.5">
        {activities.map((a) => {
          const Icon = CATEGORY_ICON[a.category] ?? Activity
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => navigate('/workouts')}
              className="flex w-full items-center gap-2.5 rounded-lg bg-slate-800/40 px-2.5 py-2 text-left active:bg-slate-800"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                <Icon size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-medium text-slate-100">{a.name}</span>
                  <span className="shrink-0 text-xs text-slate-500">{dayLabel(a.date)}</span>
                </div>
                <p className="truncate text-xs text-slate-500">{a.summary}</p>
              </div>
              <ChevronRight size={16} className="shrink-0 text-slate-600" />
            </button>
          )
        })}
      </div>
    </Card>
  )
}

// The activity feed — a reverse-chronological list of every cardio session, with
// the three numbers that define it on the row and everything else one tap away.
//
// This is the shape Strava, Garmin Connect and MapMyRun all converge on, and for
// a good reason: a chart answers "how am I trending", but it cannot answer "what
// did I actually do on Tuesday". Until now the app had only the chart.
//
// Rows render from a plain array rather than a virtualised list. A year of daily
// activity is a few hundred rows, and the page shows 20 at a time — a windowing
// library would be weight for a problem that does not exist here.

import { useMemo, useState } from 'react'
import {
  Bike,
  ChevronDown,
  Footprints,
  Heart,
  Mountain,
  Snowflake,
  Dumbbell,
  Activity,
  type LucideIcon,
} from 'lucide-react'
import Card from '../../components/Card'
import { useWorkoutsStore } from '../../store/workouts'
import { useSettingsStore } from '../../store/settings'
import {
  activityCategory,
  cardioSeries,
  distanceUnitLabel,
  elevationUnitLabel,
  formatDuration,
  formatPace,
  formatTotalDuration,
  isCardioSession,
  toDisplayElevation,
  type ActivityCategory,
  type CardioPoint,
  type CardioRange,
} from './cardio'
import { monthDayLabel } from '../progress/utils'

const PAGE_SIZE = 20

const CATEGORY_ICON: Record<ActivityCategory, LucideIcon> = {
  Run: Footprints,
  Walk: Footprints,
  Hike: Mountain,
  Bike: Bike,
  Ski: Snowflake,
  Strength: Dumbbell,
  Other: Activity,
}

export default function ActivityFeedSection({
  range,
  category,
}: {
  range: CardioRange
  /** Null shows every sport, matching the chart's "no tab selected" state. */
  category: ActivityCategory | null
}) {
  const sessions = useWorkoutsStore((s) => s.sessions)
  const units = useSettingsStore((s) => s.units)
  const distUnit = distanceUnitLabel(units)
  const elevUnit = elevationUnitLabel(units)
  const [shown, setShown] = useState(PAGE_SIZE)
  const [openId, setOpenId] = useState<string | null>(null)

  // Every category present, or just the selected one. Built by reusing
  // cardioSeries per category so the feed and the chart can never disagree about
  // what counts as a run.
  const feed = useMemo(() => {
    const categories: ActivityCategory[] =
      category !== null
        ? [category]
        : Array.from(
            new Set(
              sessions
                .filter(isCardioSession)
                .map((s) => activityCategory(s.name, s.sportType)),
            ),
          )
    const all: { point: CardioPoint; category: ActivityCategory }[] = []
    for (const c of categories) {
      for (const point of cardioSeries(sessions, c, units, range)) all.push({ point, category: c })
    }
    // Newest first, and within a day the later start time first. Sessions with no
    // recorded clock time sort last within their day rather than jumping to the top.
    return all.sort((a, b) => {
      if (a.point.date !== b.point.date) return a.point.date < b.point.date ? 1 : -1
      return (b.point.startTime ?? '').localeCompare(a.point.startTime ?? '')
    })
  }, [sessions, category, units, range])

  if (feed.length === 0) {
    return (
      <Card className="space-y-2">
        <Header count={0} />
        <p className="text-xs text-slate-500">No activities in this date range.</p>
      </Card>
    )
  }

  return (
    <Card className="space-y-2">
      <Header count={feed.length} />

      <div className="space-y-1.5">
        {feed.slice(0, shown).map(({ point, category: c }) => (
          <ActivityRow
            key={point.id}
            point={point}
            category={c}
            distUnit={distUnit}
            elevUnit={elevUnit}
            elevate={(m) => toDisplayElevation(m, units)}
            open={openId === point.id}
            onToggle={() => setOpenId((cur) => (cur === point.id ? null : point.id))}
          />
        ))}
      </div>

      {shown < feed.length && (
        <button
          type="button"
          onClick={() => setShown((n) => n + PAGE_SIZE)}
          className="w-full rounded-full bg-slate-800 py-2 text-xs font-medium text-slate-300"
        >
          Show {Math.min(PAGE_SIZE, feed.length - shown)} more
        </button>
      )}
    </Card>
  )
}

function ActivityRow({
  point,
  category,
  distUnit,
  elevUnit,
  elevate,
  open,
  onToggle,
}: {
  point: CardioPoint
  category: ActivityCategory
  distUnit: string
  elevUnit: string
  elevate: (metres: number) => number
  open: boolean
  onToggle: () => void
}) {
  const Icon = CATEGORY_ICON[category]

  // The detail metrics that were actually recorded. Building the list first means
  // a session with nothing extra collapses to a single honest line instead of a
  // grid of dashes.
  const details: [string, string][] = []
  if (point.avgHr !== null) {
    details.push(['Avg HR', `${Math.round(point.avgHr)} bpm`])
  }
  if (point.maxHr !== null) details.push(['Max HR', `${Math.round(point.maxHr)} bpm`])
  if (point.elevationGainM !== null) {
    details.push(['Ascent', `${Math.round(elevate(point.elevationGainM)).toLocaleString()} ${elevUnit}`])
  }
  if (point.avgCadence !== null) details.push(['Cadence', `${Math.round(point.avgCadence)} spm`])
  if (point.kcal !== null) details.push(['Calories', `${Math.round(point.kcal)} kcal`])
  if (point.aerobicTe !== null) details.push(['Aerobic effect', point.aerobicTe.toFixed(1)])
  if (point.anaerobicTe !== null) details.push(['Anaerobic effect', point.anaerobicTe.toFixed(1)])
  if (point.trainingLoad !== null) {
    details.push(['Training load', String(Math.round(point.trainingLoad))])
  }

  return (
    <div className="rounded-xl bg-slate-800/40">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2.5 p-2.5 text-left"
        aria-expanded={open}
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-800">
          <Icon size={15} className="text-primary-400" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium text-slate-200">{point.name}</span>
          <span className="block text-[10px] text-slate-500">
            {monthDayLabel(point.date)}
            {point.startTime !== null && ` · ${point.startTime}`}
            {point.avgHr !== null && ` · ${Math.round(point.avgHr)} bpm`}
          </span>
        </span>

        <span className="shrink-0 text-right">
          <span className="block text-sm font-bold text-slate-100 tabular-nums">
            {point.distance !== null
              ? `${point.distance.toFixed(2)} ${distUnit}`
              : /* No distance, so duration is the headline — and a headline reads
                   better as "2h 11m" than as the stopwatch "2:11:00". */
                formatTotalDuration(point.durationMin)}
          </span>
          <span className="block text-[10px] text-slate-500 tabular-nums">
            {point.distance !== null
              ? `${formatDuration(point.durationMin)}${
                  point.pace !== null ? ` · ${formatPace(point.pace)}/${distUnit}` : ''
                }`
              : 'no distance'}
          </span>
        </span>

        <ChevronDown
          size={14}
          className={`shrink-0 text-slate-600 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="border-t border-slate-800 px-2.5 py-2">
          {details.length > 0 ? (
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              {details.map(([label, value]) => (
                <div key={label} className="flex items-baseline justify-between gap-2">
                  <dt className="truncate text-[10px] text-slate-500">{label}</dt>
                  <dd className="shrink-0 text-[11px] font-medium text-slate-200 tabular-nums">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="flex items-center gap-1.5 text-[10px] text-slate-500">
              <Heart size={11} />
              Only duration was recorded. A backfill from Settings → Pull from Garmin adds heart
              rate, ascent and cadence to older activities.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function Header({ count }: { count: number }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <Activity size={16} className="text-primary-400" />
        <h2 className="text-sm font-semibold text-slate-200">Activities</h2>
      </div>
      {count > 0 && <span className="text-[11px] text-slate-500">{count} in range</span>}
    </div>
  )
}

import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import ScrubChart from '../../components/ScrubChart'
import { ChevronLeft } from 'lucide-react'
import Card from '../../components/Card'
import { useWorkoutsStore } from '../../store/workouts'
import { useSettingsStore } from '../../store/settings'
import { formatDurationMin, weightUnitLabel } from './utils'
import { lifetimeStats, muscleSetVolume, weeklyStreak, workoutsPerWeek } from './stats'
import CardioDashboard from './CardioDashboard'

type WorkoutStatsProps = {
  onBack: () => void
}

export default function WorkoutStats({ onBack }: WorkoutStatsProps) {
  const sessions = useWorkoutsStore((s) => s.sessions)
  const units = useSettingsStore((s) => s.units)
  const unitLabel = weightUnitLabel(units)

  const lifetime = useMemo(() => lifetimeStats(sessions), [sessions])
  const streak = useMemo(() => weeklyStreak(sessions), [sessions])
  const weekly = useMemo(() => workoutsPerWeek(sessions, 12), [sessions])
  const muscles = useMemo(() => muscleSetVolume(sessions, 30).slice(0, 10), [sessions])
  const maxSets = muscles.reduce((max, m) => Math.max(max, m.sets), 0)

  const header = (
    <header className="flex items-center gap-2">
      <button
        type="button"
        onClick={onBack}
        aria-label="Back"
        className="w-9 h-9 rounded-full bg-slate-800 active:bg-slate-700 flex items-center justify-center text-slate-300"
      >
        <ChevronLeft size={18} />
      </button>
      <h1 className="text-lg font-bold text-slate-100">Statistics</h1>
    </header>
  )

  if (lifetime.workouts === 0) {
    return (
      <div className="p-4 pb-24 space-y-4">
        {header}
        <Card>
          <p className="text-sm text-slate-500">Finish your first workout to unlock training stats.</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-4 pb-24 space-y-4">
      {header}

      <Card>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-slate-800/60 p-3 text-center">
            <p className="text-xl font-bold text-slate-100">{lifetime.workouts}</p>
            <p className="text-xs text-slate-500">Workouts</p>
          </div>
          <div className="rounded-xl bg-slate-800/60 p-3 text-center">
            <p className="text-xl font-bold text-slate-100">
              {Math.round(lifetime.volume).toLocaleString()} {unitLabel}
            </p>
            <p className="text-xs text-slate-500">Total volume</p>
          </div>
          <div className="rounded-xl bg-slate-800/60 p-3 text-center">
            <p className="text-xl font-bold text-slate-100">{lifetime.reps.toLocaleString()}</p>
            <p className="text-xs text-slate-500">Total reps</p>
          </div>
          <div className="rounded-xl bg-slate-800/60 p-3 text-center">
            <p className="text-xl font-bold text-slate-100">{formatDurationMin(lifetime.durationMs)}</p>
            <p className="text-xs text-slate-500">Time trained</p>
          </div>
          <div className="rounded-xl bg-slate-800/60 p-3 text-center">
            <p className="text-xl font-bold text-slate-100">{streak}</p>
            <p className="text-xs text-slate-500">Week streak</p>
          </div>
        </div>
      </Card>

      <CardioDashboard />

      <Card>
        <h2 className="text-sm font-semibold text-slate-200 mb-3">Workouts per week</h2>
        <ScrubChart
          data={weekly}
          height={180}
          label={(w) => `week of ${w.label}`}
          values={(w) => (w.count > 0 ? [{ key: 'n', value: `${w.count} workout${w.count === 1 ? '' : 's'}` }] : [])}
          empty="none"
        >
            <BarChart data={weekly} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#1e293b" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: '#64748b', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                minTickGap={20}
              />
              <YAxis
                tick={{ fill: '#64748b', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={44}
                allowDecimals={false}
              />
              <Bar dataKey="count" fill="#34d399" radius={[4, 4, 0, 0]} />
            </BarChart>
        </ScrubChart>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-slate-200 mb-3">Muscle balance · last 30 days</h2>
        {muscles.length === 0 ? (
          <p className="text-sm text-slate-500">Log some workouts to see which muscles you're training.</p>
        ) : (
          <div className="space-y-2">
            {muscles.map((m) => (
              <div key={m.muscle} className="flex items-center gap-3">
                <span className="text-xs text-slate-300 w-24 shrink-0">{m.label}</span>
                <div className="flex-1 h-2.5 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(m.sets / maxSets) * 100}%`, background: '#34d399' }}
                  />
                </div>
                <span className="text-xs tabular-nums text-slate-400 w-8 text-right">{m.sets}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dumbbell, Flame, GlassWater } from 'lucide-react'
import Card from '../../components/Card'
import RingChart from '../../components/RingChart'
import MacroBar from '../../components/MacroBar'
import Button from '../../components/Button'
import { useNutritionStore, entriesForDate } from '../../store/nutrition'
import { useSettingsStore } from '../../store/settings'
import { useBodyStore } from '../../store/body'
import { useWorkoutsStore } from '../../store/workouts'
import { addDays, isoToLabel, todayISO, weekdayIndex } from '../../lib/date'
import { macroPct, sumMacros } from '../../lib/macros'

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export default function Dashboard() {
  const navigate = useNavigate()
  const entries = useNutritionStore((s) => s.entries)
  const goals = useSettingsStore((s) => s.goals)
  const bodyEntries = useBodyStore((s) => s.entries)
  const routines = useWorkoutsStore((s) => s.routines)
  const activeSessionId = useWorkoutsStore((s) => s.activeSessionId)

  const today = todayISO()
  const todayWaterMl = useNutritionStore((s) => s.water[today] ?? 0)
  const todayEntries = useMemo(() => entriesForDate(entries, today), [entries, today])
  const totals = useMemo(() => sumMacros(todayEntries), [todayEntries])
  const remaining = Math.max(0, goals.calories - totals.calories)

  const streak = useMemo(() => {
    let count = 0
    let cursor = today
    while (entriesForDate(entries, cursor).length > 0) {
      count += 1
      cursor = addDays(cursor, -1)
    }
    return count
  }, [entries, today])

  const latestWeight = useMemo(() => {
    if (bodyEntries.length === 0) return null
    return [...bodyEntries].sort((a, b) => (a.date < b.date ? 1 : -1))[0]
  }, [bodyEntries])

  const recentMeals = useMemo(() => todayEntries.slice(-3).reverse(), [todayEntries])

  const todaysRoutine = useMemo(() => {
    const weekday = weekdayIndex(today)
    return routines.find((r) => r.scheduleDays?.includes(weekday))
  }, [routines, today])

  return (
    <div className="p-4 pb-24 space-y-4">
      <header>
        <h1 className="text-xl font-bold text-slate-100">{greeting()}</h1>
        <p className="text-sm text-slate-400">{isoToLabel(today)}</p>
      </header>

      <Card className="flex flex-col items-center gap-4">
        <RingChart
          value={macroPct(totals.calories, goals.calories)}
          size={168}
          label={`${Math.round(remaining)}`}
          sublabel="kcal remaining"
          color="#34d399"
        />
        <div className="w-full space-y-3">
          <MacroBar label="Protein" value={totals.protein} goal={goals.protein} color="bg-emerald-400" />
          <MacroBar label="Carbs" value={totals.carbs} goal={goals.carbs} color="bg-sky-400" />
          <MacroBar label="Fat" value={totals.fat} goal={goals.fat} color="bg-amber-400" />
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Button variant="primary" onClick={() => navigate('/nutrition')}>
          Log food
        </Button>
        <Button variant="ghost" onClick={() => navigate('/workouts')}>
          Start workout
        </Button>
      </div>

      <Card className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-orange-500/15 flex items-center justify-center text-orange-400">
            <Flame size={20} />
          </div>
          <p className="text-sm text-slate-200">
            {streak > 0 ? `${streak}-day logging streak` : 'Start your streak today'}
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-sky-400 shrink-0">
          <GlassWater size={16} />
          <span className="text-sm font-medium">{(todayWaterMl / 1000).toFixed(1)} L</span>
        </div>
      </Card>

      {todaysRoutine && !activeSessionId && (
        <Card className="border-l-4 border-l-emerald-400 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-emerald-500/15 flex items-center justify-center text-emerald-400 shrink-0">
              <Dumbbell size={20} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-400">Today&apos;s workout</p>
              <p className="text-sm font-semibold text-slate-100 truncate">{todaysRoutine.name}</p>
              <p className="text-xs text-slate-500">
                {todaysRoutine.items.length} exercise{todaysRoutine.items.length === 1 ? '' : 's'}
              </p>
            </div>
          </div>
          <Button
            variant="primary"
            className="shrink-0 text-sm"
            onClick={() => navigate('/workouts', { state: { startRoutineId: todaysRoutine.id } })}
          >
            Start
          </Button>
        </Card>
      )}

      <Card>
        <h2 className="text-sm font-semibold text-slate-100 mb-2">Today&apos;s meals</h2>
        {recentMeals.length === 0 ? (
          <p className="text-xs text-slate-500">No meals logged yet today.</p>
        ) : (
          <ul className="space-y-2">
            {recentMeals.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between text-sm gap-3">
                <span className="text-slate-200 truncate">{entry.name}</span>
                <span className="text-slate-400 shrink-0">{Math.round(entry.calories)} kcal</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-slate-100 mb-1">Weight</h2>
        {latestWeight ? (
          <p className="text-sm text-slate-200">
            {latestWeight.weightKg} kg <span className="text-slate-500">· {isoToLabel(latestWeight.date)}</span>
          </p>
        ) : (
          <p className="text-xs text-slate-500">No weight logged yet</p>
        )}
      </Card>
    </div>
  )
}

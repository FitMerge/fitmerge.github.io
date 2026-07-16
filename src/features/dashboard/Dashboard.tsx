import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Dumbbell, Flame, GlassWater, HeartPulse, Settings } from 'lucide-react'
import Card from '../../components/Card'
import RingChart from '../../components/RingChart'
import Button from '../../components/Button'
import { useNutritionStore, entriesForDate } from '../../store/nutrition'
import { useSettingsStore } from '../../store/settings'
import { useBodyStore } from '../../store/body'
import { useWorkoutsStore } from '../../store/workouts'
import { healthDaysDesc, useHealthStore } from '../../store/health'
import { heroScore, scoreColor } from '../health/healthToday'
import { addDays, isoToLabel, todayISO, weekdayIndex } from '../../lib/date'
import { macroPct, sumMacros } from '../../lib/macros'
import { convertWeight, mlToFloz, weightUnit } from '../../lib/units'
import { burnedCaloriesForDate, latestBodyWeightKg } from '../../lib/exercise'

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

/** Short status word for a 0–100 recovery score. */
function scoreWord(v: number): string {
  if (v >= 66) return 'Ready'
  if (v >= 33) return 'Moderate'
  return 'Low'
}

export default function Dashboard() {
  const navigate = useNavigate()
  const entries = useNutritionStore((s) => s.entries)
  const goals = useSettingsStore((s) => s.goals)
  const units = useSettingsStore((s) => s.units)
  const bodyEntries = useBodyStore((s) => s.entries)
  const routines = useWorkoutsStore((s) => s.routines)
  const activeSessionId = useWorkoutsStore((s) => s.activeSessionId)
  const sessions = useWorkoutsStore((s) => s.sessions)
  const exerciseByDate = useNutritionStore((s) => s.exercise)
  const healthDays = useHealthStore((s) => s.days)

  const today = todayISO()
  const todayWaterMl = useNutritionStore((s) => s.water[today] ?? 0)
  const todayEntries = useMemo(() => entriesForDate(entries, today), [entries, today])
  const totals = useMemo(() => sumMacros(todayEntries), [todayEntries])
  const burned = useMemo(
    () => burnedCaloriesForDate(today, exerciseByDate, sessions, latestBodyWeightKg(bodyEntries)),
    [today, exerciseByDate, sessions, bodyEntries],
  )
  // Net budget, MyFitnessPal-style: goal − food + exercise burned.
  const remaining = Math.round(goals.calories - totals.calories + burned)

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

  const todaysRoutine = useMemo(() => {
    const weekday = weekdayIndex(today)
    return routines.find((r) => r.scheduleDays?.includes(weekday))
  }, [routines, today])

  const hero = useMemo(() => heroScore(healthDaysDesc(healthDays)), [healthDays])

  return (
    <div className="p-4 pb-24 space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-100">{greeting()}</h1>
          <p className="text-sm text-slate-400">{isoToLabel(today)}</p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/settings')}
          aria-label="Settings"
          className="shrink-0 w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 active:bg-slate-700"
        >
          <Settings size={18} />
        </button>
      </header>

      {/* Nutrition at a glance — a compact summary that opens the full food diary,
          rather than a second copy of the diary's calorie ring. */}
      <Card onClick={() => navigate('/nutrition')} className="cursor-pointer active:bg-slate-800/40">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-100">Today&apos;s food</h2>
          <span className="flex items-center text-xs text-slate-500">
            Diary <ChevronRight size={14} />
          </span>
        </div>
        <div className="mt-2 flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {remaining >= 0 ? 'Remaining' : 'Over'}
            </p>
            <p className={`text-2xl font-bold leading-tight ${remaining < 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {Math.abs(remaining).toLocaleString()}
              <span className="ml-1 text-sm font-medium text-slate-500">kcal</span>
            </p>
          </div>
          <p className="text-right text-xs leading-relaxed text-slate-400">
            {Math.round(goals.calories).toLocaleString()} goal − {Math.round(totals.calories).toLocaleString()} food
            {burned > 0 ? ` + ${burned} exercise` : ''}
          </p>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
          <div
            className={`h-full rounded-full ${totals.calories > goals.calories ? 'bg-amber-400' : 'bg-emerald-400'}`}
            style={{ width: `${Math.min(100, macroPct(totals.calories, goals.calories) * 100)}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Protein {Math.round(totals.protein)} · Carbs {Math.round(totals.carbs)} · Fat {Math.round(totals.fat)} g
        </p>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Button variant="primary" onClick={() => navigate('/nutrition', { state: { openAdd: true } })}>
          Log food
        </Button>
        <Button variant="ghost" onClick={() => navigate('/workouts')}>
          Start workout
        </Button>
      </div>

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

      {hero && (
        <Card
          onClick={() => navigate('/health')}
          className="flex items-center justify-between gap-3 cursor-pointer active:bg-slate-800/40"
        >
          <div className="flex items-center gap-3 min-w-0">
            <RingChart
              value={Math.min(1, hero.value / 100)}
              size={54}
              stroke={6}
              color={scoreColor(hero.value)}
              label={`${Math.round(hero.value)}`}
            />
            <div className="min-w-0">
              <p className="text-xs text-slate-400">{hero.label}</p>
              <p className="text-sm font-semibold text-slate-100">{scoreWord(hero.value)}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0 text-slate-500">
            <HeartPulse size={16} className="text-rose-400" />
            <ChevronRight size={16} />
          </div>
        </Card>
      )}

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
          <span className="text-sm font-medium">
            {units === 'imperial' ? `${Math.round(mlToFloz(todayWaterMl))} oz` : `${(todayWaterMl / 1000).toFixed(1)} L`}
          </span>
        </div>
      </Card>

      <Card onClick={() => navigate('/progress')} className="cursor-pointer active:bg-slate-800/40">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-100">Weight</h2>
          <ChevronRight size={14} className="text-slate-500" />
        </div>
        {latestWeight ? (
          <p className="mt-1 text-sm text-slate-200">
            {convertWeight(latestWeight.weightKg, units).toFixed(1)} {weightUnit(units)}{' '}
            <span className="text-slate-500">· {isoToLabel(latestWeight.date)}</span>
          </p>
        ) : (
          <p className="mt-1 text-xs text-slate-500">No weight logged yet</p>
        )}
      </Card>
    </div>
  )
}

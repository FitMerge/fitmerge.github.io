// Home variant A — "Coach briefing" (Whoop / Oura style): a three-dial daily
// status hero, a prioritized coach card, today's plan, then a compact stat strip.

import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, ChevronRight, Droplets, Dumbbell, Pill } from 'lucide-react'
import Card from '../../../components/Card'
import Button from '../../../components/Button'
import RingChart from '../../../components/RingChart'
import { useHomeData } from '../homeData'
import { buildInsights } from '../insights'
import { scoreColor } from '../../health/healthToday'
import { typicalRangeOf } from '../../progress/healthTrends'
import { metricSpark } from '../../health/healthToday'
import { isoToLabel } from '../../../lib/date'
import { mlToFloz, weightUnit } from '../../../lib/units'
import { fmtK, fmtSleep, HomeHeader, InsightRow, StatTile } from './shared'
import { weightUnitLabel } from '../../workouts/utils'

export default function HomeBriefing() {
  const navigate = useNavigate()
  const d = useHomeData()
  const insights = useMemo(() => buildInsights(d, new Date().getHours()), [d])

  const fuelPct = Math.min(1, d.foodCalories / Math.max(1, d.goals.calories + d.burned))
  const overBudget = d.remaining < 0
  const stepsPct = d.steps != null ? Math.min(1, d.steps / d.stepsGoal) : 0
  const waterPct = Math.min(1, d.waterMl / Math.max(1, d.waterGoalMl))
  const hrvSpark = useMemo(() => metricSpark(d.healthDesc, 'hrv', 14), [d.healthDesc])
  const hrvBand = useMemo(() => typicalRangeOf(hrvSpark), [hrvSpark])

  return (
    <div className="space-y-4 p-4 pb-24">
      <HomeHeader sub={isoToLabel(d.today)} />

      {/* Daily status hero — recovery, fuel and movement as three dials. */}
      <Card className="bg-gradient-to-br from-emerald-500/10 via-slate-900 to-slate-900">
        <div className="flex justify-around">
          <Dial
            pct={d.hero ? d.hero.value / 100 : 0}
            color={d.hero ? scoreColor(d.hero.value) : '#334155'}
            value={d.hero ? `${Math.round(d.hero.value)}` : '—'}
            label="Recovery"
            sub={d.hero ? d.hero.label : 'No data'}
            onClick={() => navigate('/health')}
          />
          <Dial
            pct={fuelPct}
            color={overBudget ? '#fbbf24' : '#34d399'}
            value={Math.abs(d.remaining).toLocaleString()}
            label="Fuel"
            sub={overBudget ? 'kcal over' : 'kcal left'}
            onClick={() => navigate('/nutrition')}
          />
          <Dial
            pct={stepsPct}
            color="#38bdf8"
            value={d.steps != null ? fmtK(d.steps) : '—'}
            label="Move"
            sub={`of ${fmtK(d.stepsGoal)} steps`}
            onClick={() => navigate('/health')}
          />
        </div>
      </Card>

      {/* Coach — the day's top reads, in priority order. */}
      {insights.length > 0 && (
        <Card className="space-y-1">
          <h2 className="px-1.5 text-sm font-semibold text-slate-100">Coach</h2>
          {insights.slice(0, 4).map((i) => (
            <InsightRow key={i.id} insight={i} />
          ))}
        </Card>
      )}

      {/* Today's plan — workout, supplements, water in one place. */}
      <Card className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-100">Today&apos;s plan</h2>

        {d.todaysRoutine && (
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                {d.trainedToday ? <Check size={17} /> : <Dumbbell size={17} />}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-100">{d.todaysRoutine.name}</p>
                <p className="text-xs text-slate-500">
                  {d.trainedToday ? 'Done — nice work' : `${d.todaysRoutine.items.length} exercises`}
                </p>
              </div>
            </div>
            {!d.trainedToday && !d.activeSessionId && (
              <Button
                variant="primary"
                className="shrink-0 text-sm"
                onClick={() => navigate('/workouts', { state: { startRoutineId: d.todaysRoutine?.id } })}
              >
                Start
              </Button>
            )}
          </div>
        )}

        {d.supplements.length > 0 && (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-500/15 text-violet-400">
                <Pill size={17} />
              </span>
              <p className="text-sm text-slate-200">Supplements</p>
            </div>
            <div className="flex items-center gap-1.5">
              {d.supplements.map((s, i) => (
                <span
                  key={s.id}
                  className={`h-2.5 w-2.5 rounded-full ${i < d.supplementsTaken ? 'bg-violet-400' : 'bg-slate-700'}`}
                />
              ))}
              <span className="ml-1 text-xs text-slate-500">
                {d.supplementsTaken}/{d.supplements.length}
              </span>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-500/15 text-sky-400">
            <Droplets size={17} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between">
              <p className="text-sm text-slate-200">Water</p>
              <p className="text-xs text-slate-400">
                {d.units === 'imperial'
                  ? `${Math.round(mlToFloz(d.waterMl))} / ${Math.round(mlToFloz(d.waterGoalMl))} oz`
                  : `${(d.waterMl / 1000).toFixed(1)} / ${(d.waterGoalMl / 1000).toFixed(1)} L`}
              </p>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-800">
              <div className="h-full rounded-full bg-sky-400" style={{ width: `${waterPct * 100}%` }} />
            </div>
          </div>
        </div>
      </Card>

      {/* Cross-page stat strip. */}
      <div className="grid grid-cols-2 gap-2">
        <StatTile
          label="Weight"
          value={d.weight ? d.weight.latest.toFixed(1) : '—'}
          unit={weightUnit(d.units)}
          sub={
            d.weight
              ? `${d.weight.ratePerWeek < 0 ? '↓' : '↑'} ${Math.abs(d.weight.ratePerWeek).toFixed(1)} ${weightUnit(d.units)}/wk`
              : 'Not logged'
          }
          subTone={d.weight && d.weight.ratePerWeek < 0 ? 'good' : undefined}
          spark={d.weightSpark}
          to="/progress"
        />
        <StatTile
          label="Sleep"
          value={d.sleepMinutes != null ? fmtSleep(d.sleepMinutes) : '—'}
          sub={d.highlights.find((h) => h.key === 'sleepMinutes')?.note}
          subTone={d.highlights.find((h) => h.key === 'sleepMinutes')?.tone === 'good' ? 'good' : undefined}
          to="/health"
        />
        <StatTile
          label="HRV"
          value={d.highlights.find((h) => h.key === 'hrv')?.value ?? '—'}
          sub={d.highlights.find((h) => h.key === 'hrv')?.note}
          subTone={d.highlights.find((h) => h.key === 'hrv')?.tone === 'good' ? 'good' : undefined}
          spark={hrvSpark}
          sparkColor="#a78bfa"
          sparkBand={hrvBand ? [hrvBand.low, hrvBand.high] : undefined}
          to="/health"
        />
        <StatTile
          label="Volume this week"
          value={fmtK(d.week.volume)}
          unit={weightUnitLabel(d.units)}
          sub={`${d.week.sessions} workout${d.week.sessions === 1 ? '' : 's'}`}
          spark={d.week.weeklyVolumes}
          sparkColor="#818cf8"
          to="/progress"
        />
      </div>
    </div>
  )
}

function Dial({
  pct,
  color,
  value,
  label,
  sub,
  onClick,
}: {
  pct: number
  color: string
  value: string
  label: string
  sub: string
  onClick: () => void
}) {
  return (
    <button type="button" onClick={onClick} className="flex flex-col items-center gap-1">
      <RingChart value={pct} size={92} stroke={9} color={color} label={value} />
      <p className="text-xs font-semibold text-slate-200">{label}</p>
      <p className="text-[10px] text-slate-500">{sub}</p>
      <ChevronRight size={12} className="hidden" />
    </button>
  )
}

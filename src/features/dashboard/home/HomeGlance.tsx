// Home variant B — "Glance grid" (Apple Fitness / Garmin at-a-glance style):
// big goal rings up top, one headline insight banner, then a 2×3 grid of
// sparkline stat tiles pulling the key number from every page.

import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Dumbbell } from 'lucide-react'
import Card from '../../../components/Card'
import Button from '../../../components/Button'
import RingChart from '../../../components/RingChart'
import { useHomeData } from '../homeData'
import { buildInsights } from '../insights'
import { metricSpark, scoreColor } from '../../health/healthToday'
import { typicalRangeOf } from '../../progress/healthTrends'
import { isoToLabel } from '../../../lib/date'
import { mlToFloz, weightUnit } from '../../../lib/units'
import { weightUnitLabel } from '../../workouts/utils'
import { fmtK, fmtSleep, HomeHeader, INSIGHT_ICONS, StatTile, TONE_BG, TONE_TEXT } from './shared'

export default function HomeGlance() {
  const navigate = useNavigate()
  const d = useHomeData()
  const insights = useMemo(() => buildInsights(d, new Date().getHours()), [d])
  const top = insights[0]
  const TopIcon = top ? INSIGHT_ICONS[top.icon] : null

  const calPct = Math.min(1, d.foodCalories / Math.max(1, d.goals.calories + d.burned))
  const overBudget = d.remaining < 0
  const proteinPct = Math.min(1, d.protein / Math.max(1, d.goals.protein))
  const stepsPct = d.steps != null ? Math.min(1, d.steps / d.stepsGoal) : 0

  const bbSpark = useMemo(() => metricSpark(d.healthDesc, 'bodyBattery', 14), [d.healthDesc])
  const rhrSpark = useMemo(() => metricSpark(d.healthDesc, 'restingHr', 14), [d.healthDesc])
  const rhrBand = useMemo(() => typicalRangeOf(rhrSpark), [rhrSpark])
  const sleepHl = d.highlights.find((h) => h.key === 'sleepMinutes')
  const rhrHl = d.highlights.find((h) => h.key === 'restingHr')

  return (
    <div className="space-y-4 p-4 pb-24">
      <HomeHeader sub={isoToLabel(d.today)} />

      {/* Goal rings — calories, protein, steps. */}
      <Card className="bg-gradient-to-b from-slate-900 to-slate-900/40">
        <div className="flex justify-around">
          <Ring
            pct={calPct}
            color={overBudget ? '#fbbf24' : '#34d399'}
            value={Math.abs(d.remaining).toLocaleString()}
            title={overBudget ? 'kcal over' : 'kcal left'}
            onClick={() => navigate('/nutrition')}
          />
          <Ring
            pct={proteinPct}
            color="#f472b6"
            value={`${Math.round(d.protein)}`}
            title={`of ${Math.round(d.goals.protein)} g protein`}
            onClick={() => navigate('/nutrition')}
          />
          <Ring
            pct={stepsPct}
            color="#38bdf8"
            value={d.steps != null ? fmtK(d.steps) : '—'}
            title={`of ${fmtK(d.stepsGoal)} steps`}
            onClick={() => navigate('/health')}
          />
        </div>
      </Card>

      {/* Headline insight of the day. */}
      {top && TopIcon && (
        <button
          type="button"
          onClick={() => navigate(top.to)}
          className="flex w-full items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-3 text-left active:bg-slate-800/60"
        >
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${TONE_BG[top.tone]}`}>
            <TopIcon size={18} className={TONE_TEXT[top.tone]} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-slate-100">{top.title}</span>
            <span className="block truncate text-xs text-slate-400">{top.body}</span>
          </span>
          <ChevronRight size={16} className="shrink-0 text-slate-600" />
        </button>
      )}

      {/* Today's workout. */}
      {d.todaysRoutine && !d.trainedToday && !d.activeSessionId && (
        <Card className="flex items-center justify-between gap-3 border-l-4 border-l-emerald-400">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
              <Dumbbell size={19} />
            </span>
            <div className="min-w-0">
              <p className="text-xs text-slate-400">Today&apos;s workout</p>
              <p className="truncate text-sm font-semibold text-slate-100">{d.todaysRoutine.name}</p>
            </div>
          </div>
          <Button
            variant="primary"
            className="shrink-0 text-sm"
            onClick={() => navigate('/workouts', { state: { startRoutineId: d.todaysRoutine?.id } })}
          >
            Start
          </Button>
        </Card>
      )}

      {/* The key number from every page, each with its recent shape. */}
      <div className="grid grid-cols-2 gap-2">
        <StatTile
          label="Weight"
          value={d.weight ? d.weight.latest.toFixed(1) : '—'}
          unit={weightUnit(d.units)}
          sub={
            d.weight
              ? `${d.weight.ratePerWeek < 0 ? '↓' : '↑'} ${Math.abs(d.weight.ratePerWeek).toFixed(1)}/wk · ${
                  d.weight.change < 0 ? '' : '+'
                }${d.weight.change.toFixed(1)} in 90d`
              : 'Not logged yet'
          }
          subTone={d.weight && d.weight.change < 0 ? 'good' : undefined}
          spark={d.weightSpark}
          to="/progress"
        />
        <StatTile
          label="Body Battery"
          value={d.hero ? `${Math.round(d.hero.value)}` : '—'}
          sub={d.hero && d.hero.value >= 66 ? 'Charged — ready to train' : d.hero ? 'Recharging' : undefined}
          subTone={d.hero && d.hero.value >= 66 ? 'good' : undefined}
          spark={bbSpark}
          sparkColor={d.hero ? scoreColor(d.hero.value) : '#34d399'}
          to="/health"
        />
        <StatTile
          label="Sleep"
          value={d.sleepMinutes != null ? fmtSleep(d.sleepMinutes) : '—'}
          sub={sleepHl?.note}
          subTone={sleepHl?.tone === 'good' ? 'good' : sleepHl?.tone === 'bad' ? 'warn' : undefined}
          to="/health"
        />
        <StatTile
          label="Resting HR"
          value={rhrHl?.value ?? '—'}
          sub={rhrHl?.note}
          subTone={rhrHl?.tone === 'good' ? 'good' : rhrHl?.tone === 'bad' ? 'warn' : undefined}
          spark={rhrSpark}
          sparkColor="#f87171"
          sparkBand={rhrBand ? [rhrBand.low, rhrBand.high] : undefined}
          to="/health"
        />
        <StatTile
          label="Training volume"
          value={fmtK(d.week.volume)}
          unit={weightUnitLabel(d.units)}
          sub={`${d.week.sessions} session${d.week.sessions === 1 ? '' : 's'} this week`}
          spark={d.week.weeklyVolumes}
          sparkColor="#818cf8"
          to="/progress"
        />
        <StatTile
          label="Water"
          value={
            d.units === 'imperial' ? `${Math.round(mlToFloz(d.waterMl))}` : (d.waterMl / 1000).toFixed(1)
          }
          unit={d.units === 'imperial' ? 'oz' : 'L'}
          sub={`of ${
            d.units === 'imperial' ? `${Math.round(mlToFloz(d.waterGoalMl))} oz` : `${(d.waterGoalMl / 1000).toFixed(1)} L`
          } · ${d.streak > 0 ? `${d.streak}-day streak` : 'log with +'}`}
          to="/"
        />
      </div>
    </div>
  )
}

function Ring({ pct, color, value, title, onClick }: { pct: number; color: string; value: string; title: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex flex-col items-center gap-1.5">
      <RingChart value={pct} size={96} stroke={10} color={color} label={value} />
      <p className="text-[11px] text-slate-400">{title}</p>
    </button>
  )
}

// Home — the "coach briefing" dashboard. Logging lives behind the + button, so
// home is a read-and-decide surface: three status dials (recovery / fuel / move),
// a prioritized rule-based coach, today's plan, and the key stat from every page.
// Styled after the daily-brief homes of Whoop and Oura.

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Droplets, Dumbbell, Minus, Plus, Sparkles } from 'lucide-react'
import Card from '../../components/Card'
import Button from '../../components/Button'
import CoachSheet from './CoachSheet'
import LogWaterSheet from '../nutrition/LogWaterSheet'
import SupplementList from '../assistant/SupplementList'
import { useNutritionStore } from '../../store/nutrition'
import { useHomeData } from './homeData'
import { buildInsights } from './insights'
import { metricSpark } from '../health/healthToday'
import { typicalRangeOf } from '../progress/healthTrends'
import { isoToLabel } from '../../lib/date'
import { mlToFloz, weightUnit } from '../../lib/units'
import { weightUnitLabel } from '../workouts/utils'
import { fmtK, fmtSleep, HomeHeader, INSIGHT_ICONS, InsightRow, StatTile, TONE_BG, TONE_TEXT } from './home/shared'

// One glass, for the home row's quick add/remove.
const QUICK_WATER_ML = 250

export default function Dashboard() {
  const navigate = useNavigate()
  const d = useHomeData()
  const addWater = useNutritionStore((s) => s.addWater)
  const [coachOpen, setCoachOpen] = useState(false)
  const [waterOpen, setWaterOpen] = useState(false)
  const insights = useMemo(() => buildInsights(d, new Date().getHours()), [d])
  const featured = insights[0]
  const FeaturedIcon = featured ? INSIGHT_ICONS[featured.icon] : null

  const waterPct = Math.min(1, d.waterMl / Math.max(1, d.waterGoalMl))
  const waterLabel =
    d.units === 'imperial'
      ? `${Math.round(mlToFloz(d.waterMl))} / ${Math.round(mlToFloz(d.waterGoalMl))} oz`
      : `${(d.waterMl / 1000).toFixed(1)} / ${(d.waterGoalMl / 1000).toFixed(1)} L`

  const hrvSpark = useMemo(() => metricSpark(d.healthDesc, 'hrv', 14), [d.healthDesc])
  const hrvBand = useMemo(() => typicalRangeOf(hrvSpark), [hrvSpark])
  const rhrSpark = useMemo(() => metricSpark(d.healthDesc, 'restingHr', 14), [d.healthDesc])
  const rhrBand = useMemo(() => typicalRangeOf(rhrSpark), [rhrSpark])
  const sleepSpark = useMemo(() => metricSpark(d.healthDesc, 'sleepMinutes', 14), [d.healthDesc])
  const sleepBand = useMemo(() => typicalRangeOf(sleepSpark), [sleepSpark])
  // Centered 5-point average over the raw weigh-ins — the tile-sized version of
  // the Progress page's bold trend line.
  const weightTrend = useMemo(() => {
    const v = d.weightSpark
    if (v.length < 2) return undefined
    return v.map((_, i) => {
      let sum = 0
      let n = 0
      for (let j = Math.max(0, i - 2); j <= Math.min(v.length - 1, i + 2); j++) {
        sum += v[j]
        n++
      }
      return sum / n
    })
  }, [d.weightSpark])
  const sleepHl = d.highlights.find((h) => h.key === 'sleepMinutes')
  const hrvHl = d.highlights.find((h) => h.key === 'hrv')
  const rhrHl = d.highlights.find((h) => h.key === 'restingHr')

  const headerSub = d.todaysRoutine && !d.trainedToday
    ? `${isoToLabel(d.today)} · ${d.todaysRoutine.name} scheduled`
    : isoToLabel(d.today)

  return (
    <div className="space-y-4 p-4 pb-24">
      <HomeHeader sub={headerSub} />

      {/* Coach — AI plan on demand, then the featured rule-based read + rows. */}
      <Card className="space-y-2">
        <h2 className="flex items-center gap-1.5 px-1 text-sm font-semibold text-slate-100">
          <Sparkles size={14} className="text-primary-400" /> Coach
        </h2>

        <button
          type="button"
          onClick={() => setCoachOpen(true)}
          className="flex w-full items-center gap-3 rounded-xl bg-gradient-to-br from-primary-500/20 to-slate-900 p-3 text-left active:opacity-80"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-500/20">
            <Sparkles size={19} className="text-primary-300" />
          </span>
          <span className="min-w-0">
            <span className="block text-[15px] font-bold text-primary-200">Get today's plan</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-slate-300">
              AI reads your last 5 days and tailors training, fuel & recovery for today.
            </span>
          </span>
        </button>

        {insights.length > 0 && (
          <>
          {featured && FeaturedIcon && (
            <button
              type="button"
              onClick={() => navigate(featured.to)}
              className={`flex w-full items-start gap-3 rounded-xl p-3 text-left active:opacity-80 ${TONE_BG[featured.tone]}`}
            >
              <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-950/40">
                <FeaturedIcon size={19} className={TONE_TEXT[featured.tone]} />
              </span>
              <span className="min-w-0">
                <span className={`block text-[15px] font-bold ${TONE_TEXT[featured.tone]}`}>{featured.title}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-slate-300">{featured.body}</span>
              </span>
            </button>
          )}

          {insights.slice(1, 4).map((i) => (
            <InsightRow key={i.id} insight={i} />
          ))}
          </>
        )}
      </Card>

      {/* Today's plan — workout, supplements, water. */}
      {(d.todaysRoutine || d.supplements.length > 0 || d.waterGoalMl > 0) && (
        <Card className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-100">Today&apos;s plan</h2>

          {d.todaysRoutine && (
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => navigate('/workouts', { state: { previewRoutineId: d.todaysRoutine?.id } })}
                className="flex min-w-0 items-center gap-3 text-left active:opacity-80"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                  {d.trainedToday ? <Check size={17} /> : <Dumbbell size={17} />}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-100">{d.todaysRoutine.name}</p>
                  <p className="text-xs text-slate-500">
                    {d.trainedToday ? 'Done — nice work' : `${d.todaysRoutine.items.length} exercises`}
                  </p>
                </div>
              </button>
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

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setWaterOpen(true)}
              className="flex min-w-0 flex-1 items-center gap-3 text-left active:opacity-80"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-500/15 text-sky-400">
                <Droplets size={17} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between">
                  <p className="text-sm text-slate-200">Water</p>
                  <p className="text-xs text-slate-400">{waterLabel}</p>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-800">
                  <div className="h-full rounded-full bg-sky-400" style={{ width: `${waterPct * 100}%` }} />
                </div>
              </div>
            </button>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                aria-label="Remove a glass of water"
                onClick={() => addWater(d.today, -QUICK_WATER_ML)}
                disabled={d.waterMl <= 0}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-slate-300 active:bg-slate-700 disabled:opacity-40"
              >
                <Minus size={16} />
              </button>
              <button
                type="button"
                aria-label="Add a glass of water"
                onClick={() => addWater(d.today, QUICK_WATER_ML)}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/20 text-sky-300 active:bg-sky-500/30"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* Daily goals + any challenge you're in — the habits checklist, inline,
          where the recovery/fuel/move dials used to be. */}
      <Card className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-100">Daily goals</h2>
        <SupplementList />
      </Card>

      {/* The key stat from every page, with its recent shape. */}
      <div className="grid grid-cols-2 gap-2">
        <StatTile
          label="Weight"
          value={d.weight ? d.weight.latest.toFixed(1) : '—'}
          unit={weightUnit(d.units)}
          sub={
            d.weight
              ? `${d.weight.ratePerWeek < 0 ? '↓' : '↑'} ${Math.abs(d.weight.ratePerWeek).toFixed(1)} ${weightUnit(d.units)}/wk`
              : 'Log with +'
          }
          subTone={d.weight && d.weight.ratePerWeek < 0 ? 'good' : undefined}
          spark={d.weightSpark}
          sparkTrend={weightTrend}
          span="last 14 weigh-ins"
          to="/health"
        />
        <StatTile
          label="Sleep"
          value={d.sleepMinutes != null ? fmtSleep(d.sleepMinutes) : '—'}
          sub={sleepHl?.note ?? (d.sleepScore != null ? `score ${Math.round(d.sleepScore)}` : undefined)}
          subTone={sleepHl?.tone === 'good' ? 'good' : sleepHl?.tone === 'bad' ? 'warn' : undefined}
          spark={sleepSpark}
          sparkColor="#38bdf8"
          sparkBand={sleepBand ? [sleepBand.low, sleepBand.high] : undefined}
          span="14 nights"
          to="/health"
        />
        <StatTile
          label="HRV"
          value={hrvHl?.value ?? '—'}
          sub={hrvHl?.note}
          subTone={hrvHl?.tone === 'good' ? 'good' : hrvHl?.tone === 'bad' ? 'warn' : undefined}
          spark={hrvSpark}
          sparkColor="#a78bfa"
          sparkBand={hrvBand ? [hrvBand.low, hrvBand.high] : undefined}
          span="14 days"
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
          span="14 days"
          to="/health"
        />
        <StatTile
          label="Volume this week"
          value={fmtK(d.week.volume)}
          unit={weightUnitLabel(d.units)}
          sub={`${d.week.sessions} workout${d.week.sessions === 1 ? '' : 's'}`}
          spark={d.week.weeklyVolumes}
          sparkColor="#818cf8"
          span="8 weeks"
          to="/workouts"
        />
        <StatTile
          label="Streak"
          value={`${d.streak}`}
          unit={d.streak === 1 ? 'day' : 'days'}
          sub={d.streak > 0 ? 'logging streak 🔥' : 'log food to start'}
          subTone={d.streak >= 7 ? 'good' : undefined}
          to="/nutrition"
        />
      </div>

      <CoachSheet open={coachOpen} onClose={() => setCoachOpen(false)} />
      <LogWaterSheet open={waterOpen} onClose={() => setWaterOpen(false)} date={d.today} />
    </div>
  )
}

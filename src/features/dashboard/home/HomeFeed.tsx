// Home variant C — "Smart feed" (Oura insight-timeline style): a chip strip of
// live scores up top, then the full prioritized coach feed as rich cards, with
// today's workout woven in after the first insight.

import { useMemo, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Dumbbell } from 'lucide-react'
import Card from '../../../components/Card'
import Button from '../../../components/Button'
import RingChart from '../../../components/RingChart'
import Sparkline from '../../../components/Sparkline'
import SupplementList from '../../assistant/SupplementList'
import { useHomeData } from '../homeData'
import { buildInsights, type Insight } from '../insights'
import { scoreColor } from '../../health/healthToday'
import { isoToLabel } from '../../../lib/date'
import { mlToFloz, weightUnit } from '../../../lib/units'
import { fmtK, HomeHeader, INSIGHT_ICONS, TONE_BG, TONE_TEXT } from './shared'

export default function HomeFeed() {
  const navigate = useNavigate()
  const d = useHomeData()
  const insights = useMemo(() => buildInsights(d, new Date().getHours()), [d])

  const chips: { label: string; value: string; to: string }[] = []
  if (d.hero) chips.push({ label: 'Recovery', value: `${Math.round(d.hero.value)}`, to: '/health' })
  chips.push({
    label: d.remaining < 0 ? 'kcal over' : 'kcal left',
    value: Math.abs(d.remaining).toLocaleString(),
    to: '/nutrition',
  })
  if (d.steps != null) chips.push({ label: 'steps', value: fmtK(d.steps), to: '/health' })
  if (d.weight) chips.push({ label: weightUnit(d.units), value: d.weight.latest.toFixed(1), to: '/progress' })
  chips.push({
    label: 'water',
    value: d.units === 'imperial' ? `${Math.round(mlToFloz(d.waterMl))} oz` : `${(d.waterMl / 1000).toFixed(1)} L`,
    to: '/',
  })

  return (
    <div className="space-y-4 p-4 pb-24">
      <HomeHeader sub={isoToLabel(d.today)} />

      {/* Live score chips — swipe across the day's numbers. */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {chips.map((c) => (
          <button
            key={c.label}
            type="button"
            onClick={() => navigate(c.to)}
            className="flex shrink-0 items-baseline gap-1.5 rounded-full border border-slate-800 bg-slate-900 px-3.5 py-2 active:bg-slate-800"
          >
            <span className="text-sm font-bold text-slate-100">{c.value}</span>
            <span className="text-[11px] text-slate-500">{c.label}</span>
          </button>
        ))}
      </div>

      {/* Feed: insight cards in coach-priority order, workout woven in near the top. */}
      {insights.slice(0, 1).map((i) => (
        <FeedCard key={i.id} insight={i} viz={vizFor(i, d)} />
      ))}

      {d.todaysRoutine && !d.trainedToday && !d.activeSessionId && (
        <Card className="flex items-center justify-between gap-3 bg-gradient-to-r from-emerald-500/15 to-slate-900">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300">
              <Dumbbell size={19} />
            </span>
            <div className="min-w-0">
              <p className="text-xs text-emerald-300/80">Up next</p>
              <p className="truncate text-sm font-semibold text-slate-100">{d.todaysRoutine.name}</p>
              <p className="text-xs text-slate-400">{d.todaysRoutine.items.length} exercises</p>
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

      {insights.slice(1).map((i) => (
        <FeedCard key={i.id} insight={i} viz={vizFor(i, d)} />
      ))}

      {d.supplements.length > 0 && d.supplementsTaken < d.supplements.length && (
        <Card>
          <h2 className="mb-2 text-sm font-semibold text-slate-100">Today&apos;s supplements</h2>
          <SupplementList compact />
        </Card>
      )}
    </div>
  )
}

/** Pick a small contextual visual for an insight card, when its data supports one. */
function vizFor(i: Insight, d: ReturnType<typeof useHomeData>): ReactNode {
  if (i.icon === 'recovery' && d.hero) {
    return (
      <RingChart value={d.hero.value / 100} size={52} stroke={6} color={scoreColor(d.hero.value)} label={`${Math.round(d.hero.value)}`} />
    )
  }
  if (i.icon === 'weight' && d.weightSpark.length >= 2) {
    return <Sparkline values={d.weightSpark} width={88} height={30} stroke="#34d399" fill />
  }
  if (i.id.startsWith('volume') && d.week.weeklyVolumes.some((v) => v > 0)) {
    return <Sparkline values={d.week.weeklyVolumes} width={88} height={30} stroke="#818cf8" fill />
  }
  return null
}

function FeedCard({ insight, viz }: { insight: Insight; viz: ReactNode }) {
  const navigate = useNavigate()
  const Icon = INSIGHT_ICONS[insight.icon]
  return (
    <Card onClick={() => navigate(insight.to)} className="cursor-pointer active:bg-slate-800/40">
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${TONE_BG[insight.tone]}`}>
          <Icon size={17} className={TONE_TEXT[insight.tone]} />
        </span>
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-semibold ${insight.tone === 'warn' ? 'text-amber-300' : 'text-slate-100'}`}>
            {insight.title}
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{insight.body}</p>
        </div>
        {viz ? <div className="shrink-0">{viz}</div> : <ChevronRight size={15} className="mt-1 shrink-0 text-slate-600" />}
      </div>
    </Card>
  )
}

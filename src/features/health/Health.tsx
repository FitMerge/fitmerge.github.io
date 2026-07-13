import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { HeartPulse } from 'lucide-react'
import Card from '../../components/Card'
import Button from '../../components/Button'
import RingChart from '../../components/RingChart'
import Sparkline from '../../components/Sparkline'
import { healthDaysDesc, useHealthStore } from '../../store/health'
import { formatMetric, metricMeta } from '../../lib/healthMetrics'
import { isoToLabel } from '../../lib/date'
import {
  ACTIVITY_GOALS,
  goalColor,
  heroScore,
  latestMetric,
  metricSpark,
  scoreColor,
} from './healthToday'
import FormFitnessSection from '../progress/FormFitnessSection'
import RecoveryRiskSection from '../progress/RecoveryRiskSection'
import RestingHrHrvSection from '../progress/RestingHrHrvSection'
import IntensityDistributionSection from '../progress/IntensityDistributionSection'
import HealthMetricsSection from '../progress/HealthMetricsSection'

export default function Health() {
  const navigate = useNavigate()
  const days = useHealthStore((s) => s.days)
  const desc = useMemo(() => healthDaysDesc(days), [days])

  const hero = useMemo(() => heroScore(desc), [desc])
  const heroSpark = useMemo(() => (hero ? metricSpark(desc, hero.key, 14) : []), [desc, hero])

  // Supporting "today" stats shown as chips under the hero.
  const chips = useMemo(() => {
    const keys = ['steps', 'sleepMinutes', 'restingHr', 'hrv', 'stress', 'vo2max']
    return keys
      .map((k) => {
        const m = latestMetric(desc, k)
        return m ? { key: k, value: m.value, spark: metricSpark(desc, k, 14) } : null
      })
      .filter((x): x is { key: string; value: number; spark: number[] } => x !== null)
      .slice(0, 4)
  }, [desc])

  // Activity ring gauges (progress toward daily goals).
  const gauges = useMemo(() => {
    return (['steps', 'intensityMinutes', 'floors'] as const)
      .map((k) => {
        const m = latestMetric(desc, k)
        if (!m) return null
        const goal = ACTIVITY_GOALS[k]
        return { key: k, value: m.value, goal, pct: Math.min(1, m.value / goal) }
      })
      .filter((x): x is { key: 'steps' | 'intensityMinutes' | 'floors'; value: number; goal: number; pct: number } => x !== null)
  }, [desc])

  if (desc.length === 0) {
    return (
      <div className="space-y-4 p-4 pb-24">
        <Header latestDate={null} />
        <Card className="space-y-3 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
            <HeartPulse size={26} />
          </div>
          <h2 className="text-base font-semibold text-slate-100">Connect your health data</h2>
          <p className="text-sm text-slate-400">
            Import from Garmin or Apple Health to see Body Battery, readiness, sleep, HRV, stress, VO₂ max,
            steps and more — each as a live trend.
          </p>
          <Button variant="primary" full onClick={() => navigate('/settings')}>
            Connect health data
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4 pb-24">
      <Header latestDate={desc[0]?.date ?? null} />

      {/* Hero status ring */}
      {hero && (
        <Card className="flex flex-col items-center gap-4">
          <RingChart
            value={hero.value / 100}
            size={168}
            stroke={14}
            color={scoreColor(hero.value)}
            label={`${Math.round(hero.value)}`}
            sublabel={hero.label}
          />
          {heroSpark.length >= 2 && (
            <Sparkline values={heroSpark} width={220} height={34} stroke={scoreColor(hero.value)} />
          )}
          {chips.length > 0 && (
            <div className="grid w-full grid-cols-2 gap-2">
              {chips.map((c) => (
                <div key={c.key} className="rounded-xl bg-slate-800/60 p-2.5">
                  <p className="truncate text-[11px] text-slate-400">{metricMeta(c.key).label}</p>
                  <div className="flex items-end justify-between gap-1">
                    <p className="text-base font-bold text-slate-100">{formatMetric(c.key, c.value)}</p>
                    {c.spark.length >= 2 && <Sparkline values={c.spark} width={56} height={20} stroke="#64748b" />}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Activity gauges */}
      {gauges.length > 0 && (
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-200">Today's activity</h2>
          <div className="flex justify-around">
            {gauges.map((g) => (
              <div key={g.key} className="flex flex-col items-center gap-1.5">
                <RingChart
                  value={g.pct}
                  size={92}
                  stroke={9}
                  color={goalColor(g.pct)}
                  label={g.value >= 1000 ? `${(g.value / 1000).toFixed(1)}k` : `${Math.round(g.value)}`}
                />
                <p className="text-[11px] text-slate-400">{metricMeta(g.key).label}</p>
                <p className="text-[10px] text-slate-600">
                  goal {g.goal >= 1000 ? `${g.goal / 1000}k` : g.goal}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      <FormFitnessSection />
      <RecoveryRiskSection />
      <RestingHrHrvSection />
      <IntensityDistributionSection />
      <HealthMetricsSection />
    </div>
  )
}

function Header({ latestDate }: { latestDate: string | null }) {
  return (
    <header className="flex items-end justify-between">
      <div>
        <h1 className="text-xl font-bold text-slate-100">Health</h1>
        <p className="text-sm text-slate-400">
          {latestDate ? `Updated ${isoToLabel(latestDate)}` : 'Recovery, sleep & daily wellness'}
        </p>
      </div>
      <HeartPulse size={22} className="mb-1 text-rose-400" />
    </header>
  )
}

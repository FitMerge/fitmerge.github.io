import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { HeartPulse } from 'lucide-react'
import Card from '../../components/Card'
import Button from '../../components/Button'
import RingChart from '../../components/RingChart'
import Sparkline from '../../components/Sparkline'
import SegmentedControl from '../../components/SegmentedControl'
import { healthDaysDesc, useHealthStore } from '../../store/health'
import { useSettingsStore } from '../../store/settings'
import { metricMeta } from '../../lib/healthMetrics'
import { isoToLabel } from '../../lib/date'
import {
  ACTIVITY_GOALS,
  goalColor,
  heroScore,
  latestMetric,
  metricSpark,
  scoreColor,
  scoreWord,
} from './healthToday'
import FormFitnessSection from '../progress/FormFitnessSection'
import RecoveryRiskSection from '../progress/RecoveryRiskSection'
import RestingHrHrvSection from '../progress/RestingHrHrvSection'
import SleepSection from '../progress/SleepSection'
import FitnessTipsSection from './FitnessTipsSection'
import IntensityDistributionSection from '../progress/IntensityDistributionSection'
import HealthMetricsSection from '../progress/HealthMetricsSection'
import HealthStorySection from '../progress/HealthStorySection'

type TabKey = 'today' | 'vitals' | 'fitness'

const TAB_OPTIONS = [
  { key: 'today' as const, label: 'Today' },
  { key: 'vitals' as const, label: 'Vitals' },
  { key: 'fitness' as const, label: 'Fitness' },
]

const TAB_BLURB: Record<TabKey, string> = {
  today: 'Your recovery and activity right now.',
  vitals: 'Heart, sleep and body trends.',
  fitness: 'Training load and performance.',
}

export default function Health() {
  const navigate = useNavigate()
  const days = useHealthStore((s) => s.days)
  const trackingSource = useSettingsStore((s) => s.trackingSource)
  const desc = useMemo(() => healthDaysDesc(days), [days])
  const [tab, setTab] = useState<TabKey>('today')

  if (desc.length === 0) {
    // Speak to how this person actually tracks — telling someone with no watch to
    // "connect Garmin" is a dead end, when they can just log sleep and steps.
    const manual = trackingSource === 'manual'
    return (
      <div className="space-y-4 p-4 pb-24">
        <Header blurb="Recovery, sleep & daily wellness" />
        <Card className="space-y-3 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
            <HeartPulse size={26} />
          </div>
          <h2 className="text-base font-semibold text-slate-100">
            {manual ? 'Track sleep and steps' : 'Connect your health data'}
          </h2>
          <p className="text-sm text-slate-400">
            {manual
              ? 'Log your sleep and steps from the + button and they’ll build into trends here. Everything else — meals, workouts, water and weight — already works without a watch.'
              : trackingSource === 'apple'
                ? 'Export your data from the Apple Health app, then import the zip to see sleep, workouts and weight as live trends.'
                : trackingSource === 'other'
                  ? 'Import a CSV or JSON export from your tracker to see sleep, heart rate and activity as live trends.'
                  : 'Import from Garmin or Apple Health to see Body Battery, readiness, sleep, HRV, stress, VO₂ max, steps and more — each as a live trend.'}
          </p>
          <Button variant="primary" full onClick={() => navigate('/settings')}>
            {manual ? 'Open settings' : 'Connect health data'}
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4 pb-24">
      <Header blurb={TAB_BLURB[tab]} latestDate={desc[0]?.date ?? null} />

      <SegmentedControl options={TAB_OPTIONS} value={tab} onChange={setTab} ariaLabel="Health view" />

      {tab === 'today' && (
        <div className="space-y-4">
          {/* Above the snapshot: what today's numbers mean only lands once you
              know which way they have been moving. */}
          <HealthStorySection />
          <TodayTab desc={desc} />
        </div>
      )}

      {tab === 'vitals' && (
        <div className="space-y-4">
          <SleepSection />
          <RestingHrHrvSection />
          <HealthMetricsSection only={['heart', 'sleep', 'activity', 'body']} title="Vitals & body metrics" />
        </div>
      )}

      {tab === 'fitness' && (
        <div className="space-y-4">
          <FormFitnessSection />
          <FitnessTipsSection />
          <RecoveryRiskSection />
          <IntensityDistributionSection />
          <HealthMetricsSection only={['training']} title="Performance metrics" />
        </div>
      )}
    </div>
  )
}

function TodayTab({ desc }: { desc: ReturnType<typeof healthDaysDesc> }) {
  const hero = useMemo(() => heroScore(desc), [desc])
  const heroSpark = useMemo(() => (hero ? metricSpark(desc, hero.key, 14) : []), [desc, hero])

  const gauges = useMemo(() => {
    return (['steps', 'intensityMinutes', 'floors'] as const)
      .map((k) => {
        const m = latestMetric(desc, k)
        if (!m) return null
        const goal = ACTIVITY_GOALS[k]
        return { key: k, value: m.value, goal, pct: Math.min(1, m.value / goal) }
      })
      .filter(
        (x): x is { key: 'steps' | 'intensityMinutes' | 'floors'; value: number; goal: number; pct: number } =>
          x !== null,
      )
  }, [desc])

  return (
    <div className="space-y-4">
      {/* Hero status ring — the single primary number for the day. */}
      {hero && (
        <Card className="flex flex-col items-center gap-3">
          <RingChart
            value={hero.value / 100}
            size={168}
            stroke={14}
            color={scoreColor(hero.value)}
            label={`${Math.round(hero.value)}`}
            sublabel={hero.label}
          />
          <p className="text-sm font-semibold" style={{ color: scoreColor(hero.value) }}>
            {scoreWord(hero.value)}
          </p>
          {heroSpark.length >= 2 && (
            <Sparkline values={heroSpark} width={220} height={34} stroke={scoreColor(hero.value)} />
          )}
        </Card>
      )}

      {/* Activity rings — today's goals. */}
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
    </div>
  )
}

function Header({ blurb, latestDate }: { blurb: string; latestDate?: string | null }) {
  return (
    <header className="flex items-end justify-between">
      <div>
        <h1 className="text-xl font-bold text-slate-100">Health</h1>
        <p className="text-sm text-slate-400">{latestDate ? `Updated ${isoToLabel(latestDate)} · ${blurb}` : blurb}</p>
      </div>
      <HeartPulse size={22} className="mb-1 text-rose-400" />
    </header>
  )
}

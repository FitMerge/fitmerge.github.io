import { useMemo } from 'react'
import Card from '../../components/Card'
import RingChart from '../../components/RingChart'
import Sparkline from '../../components/Sparkline'
import { healthDaysDesc, useHealthStore } from '../../store/health'
import { useSettingsStore } from '../../store/settings'
import { metricMeta } from '../../lib/healthMetrics'
import {
  ACTIVITY_GOALS,
  goalColor,
  heroScore,
  latestMetric,
  metricSpark,
  scoreColor,
  scoreWord,
} from './healthToday'
import { HealthHeader, ConnectPrompt } from './healthChrome'
import HealthStorySection from '../progress/HealthStorySection'
import HealthMetricsSection from '../progress/HealthMetricsSection'

export default function Vitals() {
  const days = useHealthStore((s) => s.days)
  const trackingSource = useSettingsStore((s) => s.trackingSource)
  const desc = useMemo(() => healthDaysDesc(days), [days])
  const hasHealth = desc.length > 0

  return (
    <div className="space-y-4 p-4 pb-24">
      <HealthHeader
        title="Vitals"
        blurb="Recovery, heart, sleep and daily activity."
        latestDate={hasHealth ? desc[0]?.date ?? null : null}
      />
      {hasHealth ? (
        <>
          <HealthStorySection />
          <Today desc={desc} />
          <HealthMetricsSection only={['heart', 'sleep', 'activity']} title="Heart, sleep & activity" />
        </>
      ) : (
        <ConnectPrompt trackingSource={trackingSource} />
      )}
    </div>
  )
}

function Today({ desc }: { desc: ReturnType<typeof healthDaysDesc> }) {
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

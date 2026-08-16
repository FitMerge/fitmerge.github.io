import { useMemo } from 'react'
import { Scale } from 'lucide-react'
import { healthDaysDesc, useHealthStore } from '../../store/health'
import Collapsible from '../../components/Collapsible'
import { HealthHeader } from './healthChrome'
import WeightSection from '../progress/WeightSection'
import MeasurementsSection from '../progress/MeasurementsSection'
import HealthMetricsSection from '../progress/HealthMetricsSection'

export default function Weight() {
  const days = useHealthStore((s) => s.days)
  const desc = useMemo(() => healthDaysDesc(days), [days])
  const hasHealth = desc.length > 0

  return (
    <div className="space-y-4 p-4 pb-24">
      <HealthHeader title="Weight" blurb="Weight trend, composition and measurements." icon={Scale} iconClass="text-emerald-400" />

      {/* Weight is the whole reason most people open this tab — and it works with no
          watch at all — so it leads. Composition and measurements are things few
          people track, so they sit collapsed underneath rather than pushing weight down. */}
      <WeightSection />

      <Collapsible title="Body composition & measurements" subtitle="Muscle, body fat, BMI and tape measurements">
        <div className="space-y-4">
          {hasHealth && <HealthMetricsSection only={['body']} title="Body composition" />}
          <MeasurementsSection />
        </div>
      </Collapsible>
    </div>
  )
}

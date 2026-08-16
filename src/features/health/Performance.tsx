import { useMemo } from 'react'
import { Activity } from 'lucide-react'
import { healthDaysDesc, useHealthStore } from '../../store/health'
import { useSettingsStore } from '../../store/settings'
import { HealthHeader, ConnectPrompt } from './healthChrome'
import FormFitnessSection from '../progress/FormFitnessSection'
import RecoveryRiskSection from '../progress/RecoveryRiskSection'
import FitnessTipsSection from './FitnessTipsSection'
import IntensityDistributionSection from '../progress/IntensityDistributionSection'
import HealthMetricsSection from '../progress/HealthMetricsSection'

export default function Performance() {
  const days = useHealthStore((s) => s.days)
  const trackingSource = useSettingsStore((s) => s.trackingSource)
  const desc = useMemo(() => healthDaysDesc(days), [days])
  const hasHealth = desc.length > 0

  return (
    <div className="space-y-4 p-4 pb-24">
      <HealthHeader
        title="Performance"
        blurb="Training load, VO₂ max and race predictions."
        latestDate={hasHealth ? desc[0]?.date ?? null : null}
        icon={Activity}
        iconClass="text-sky-400"
      />
      {hasHealth ? (
        <>
          <FormFitnessSection />
          <FitnessTipsSection />
          <RecoveryRiskSection />
          <IntensityDistributionSection />
          <HealthMetricsSection only={['training']} title="Performance metrics" />
        </>
      ) : (
        <ConnectPrompt trackingSource={trackingSource} />
      )}
    </div>
  )
}

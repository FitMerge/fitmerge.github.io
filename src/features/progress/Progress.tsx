import { useState } from 'react'
import RangeSelector from './RangeSelector'
import FormFitnessSection from './FormFitnessSection'
import RecoveryRiskSection from './RecoveryRiskSection'
import RestingHrHrvSection from './RestingHrHrvSection'
import IntensityDistributionSection from './IntensityDistributionSection'
import WeightSection from './WeightSection'
import MeasurementsSection from './MeasurementsSection'
import HealthMetricsSection from './HealthMetricsSection'
import CaloriesSection from './CaloriesSection'
import MacroAveragesSection from './MacroAveragesSection'
import VolumeSection from './VolumeSection'
import PersonalRecordsSection from './PersonalRecordsSection'
import type { RangeKey } from './utils'

export default function Progress() {
  const [range, setRange] = useState<RangeKey>('30d')

  return (
    <div className="p-4 pb-24 space-y-4">
      <header>
        <h1 className="text-xl font-bold text-slate-100">Progress</h1>
        <p className="text-sm text-slate-400">See trends in weight and performance over time.</p>
      </header>

      <FormFitnessSection />
      <RecoveryRiskSection />
      <RestingHrHrvSection />
      <IntensityDistributionSection />

      <WeightSection />

      <RangeSelector value={range} onChange={setRange} />

      <MeasurementsSection />
      <HealthMetricsSection />
      <CaloriesSection range={range} />
      <MacroAveragesSection range={range} />
      <VolumeSection range={range} />
      <PersonalRecordsSection />
    </div>
  )
}

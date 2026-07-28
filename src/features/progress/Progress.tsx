import { useState } from 'react'
import SegmentedControl from '../../components/SegmentedControl'
import WeightSection from './WeightSection'
import MeasurementsSection from './MeasurementsSection'
import CaloriesSection from './CaloriesSection'
import MacroAveragesSection from './MacroAveragesSection'
import VolumeSection from './VolumeSection'
import StrengthProgressSection from './StrengthProgressSection'
import PersonalRecordsSection from './PersonalRecordsSection'
import ActiveTimeSection from './ActiveTimeSection'
import CardioDashboard from '../workouts/CardioDashboard'
import { RANGE_OPTIONS, type RangeKey } from './utils'

type DomainKey = 'body' | 'nutrition' | 'lifting' | 'cardio'

const DOMAIN_OPTIONS = [
  { key: 'body' as const, label: 'Body' },
  { key: 'nutrition' as const, label: 'Food' },
  { key: 'lifting' as const, label: 'Lifting' },
  { key: 'cardio' as const, label: 'Cardio' },
]

const DOMAIN_BLURB: Record<DomainKey, string> = {
  body: 'Weight trend and measurements.',
  nutrition: 'Calories and macros over time.',
  lifting: 'Strength per exercise, volume and personal records.',
  cardio: 'Every activity — runs, walks, rides, soccer, hikes.',
}

export default function Progress() {
  const [domain, setDomain] = useState<DomainKey>('body')
  // Each domain that needs one keeps its own range so switching tabs doesn't
  // force an unrelated window. Weight self-manages a longer range internally.
  const [nutritionRange, setNutritionRange] = useState<RangeKey>('30d')
  const [liftingRange, setLiftingRange] = useState<RangeKey>('30d')

  return (
    <div className="space-y-4 p-4 pb-24">
      <header>
        <h1 className="text-xl font-bold text-slate-100">Progress</h1>
        <p className="text-sm text-slate-400">{DOMAIN_BLURB[domain]}</p>
      </header>

      <SegmentedControl
        options={DOMAIN_OPTIONS}
        value={domain}
        onChange={setDomain}
        ariaLabel="Progress domain"
      />

      {domain === 'body' && (
        <div className="space-y-4">
          <WeightSection />
          <MeasurementsSection />
        </div>
      )}

      {domain === 'nutrition' && (
        <div className="space-y-4">
          <SegmentedControl
            size="sm"
            options={RANGE_OPTIONS}
            value={nutritionRange}
            onChange={setNutritionRange}
            ariaLabel="Nutrition range"
          />
          <CaloriesSection range={nutritionRange} />
          <MacroAveragesSection range={nutritionRange} />
        </div>
      )}

      {domain === 'lifting' && (
        <div className="space-y-4">
          <SegmentedControl
            size="sm"
            options={RANGE_OPTIONS}
            value={liftingRange}
            onChange={setLiftingRange}
            ariaLabel="Lifting range"
          />
          {/* Strength first: "is the bar going up" is the question, and volume is
              context for it rather than an answer to it. */}
          <StrengthProgressSection range={liftingRange} />
          <VolumeSection range={liftingRange} />
          <PersonalRecordsSection />
        </div>
      )}

      {domain === 'cardio' && (
        <div className="space-y-4">
          <ActiveTimeSection />
          <CardioDashboard />
        </div>
      )}
    </div>
  )
}

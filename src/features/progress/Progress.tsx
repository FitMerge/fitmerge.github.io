import { useState } from 'react'
import SegmentedControl from '../../components/SegmentedControl'
import WeightSection from './WeightSection'
import MeasurementsSection from './MeasurementsSection'
import VolumeSection from './VolumeSection'
import ExerciseProgressSection from './ExerciseProgressSection'
import StrengthProgressSection from './StrengthProgressSection'
import PersonalRecordsSection from './PersonalRecordsSection'
import { LIFT_METRICS, type LiftMetric } from './lifting'
import ActiveTimeSection from './ActiveTimeSection'
import CardioDashboard from '../workouts/CardioDashboard'

type DomainKey = 'body' | 'lifting' | 'cardio'

const DOMAIN_OPTIONS = [
  { key: 'body' as const, label: 'Body' },
  { key: 'lifting' as const, label: 'Lifting' },
  { key: 'cardio' as const, label: 'Cardio' },
]

const DOMAIN_BLURB: Record<DomainKey, string> = {
  body: 'Weight trend and measurements.',
  lifting: 'Strength per exercise, volume and personal records.',
  cardio: 'Every activity — runs, walks, rides, soccer, hikes.',
}

export default function Progress() {
  const [domain, setDomain] = useState<DomainKey>('body')
  // The lifting tab is built around one question — "how is THIS lift going" — so
  // the exercise and the metric are page-level state: the chart, the all-lifts
  // list and the records card all speak about the same thing at the same time.
  const [liftMetric, setLiftMetric] = useState<LiftMetric>('heaviest')
  const [liftExerciseId, setLiftExerciseId] = useState<string | null>(null)

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

      {domain === 'lifting' && (
        <div className="space-y-4">
          {/* The one control that governs the page. Volume keeps its own range
              inside its card, so there are never two unlabelled pickers stacked
              here with no clue which drives what. */}
          <SegmentedControl
            size="sm"
            options={LIFT_METRICS.map((m) => ({ key: m.key, label: m.label }))}
            value={liftMetric}
            onChange={setLiftMetric}
            ariaLabel="Lift metric"
          />

          {/* Strength first: "is the bar going up" is the question, and combined
              volume is context for it rather than an answer to it. */}
          <ExerciseProgressSection
            metric={liftMetric}
            exerciseId={liftExerciseId}
            onSelectExercise={setLiftExerciseId}
          />
          <StrengthProgressSection
            metric={liftMetric}
            range="all"
            activeExerciseId={liftExerciseId}
            onSelectExercise={setLiftExerciseId}
          />
          <VolumeSection />
          <PersonalRecordsSection onSelectExercise={setLiftExerciseId} />
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

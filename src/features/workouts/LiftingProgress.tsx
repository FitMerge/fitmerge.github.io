// The lifting analytics, extracted so the Lifting tab can host them directly (the
// old Train → Progress → Lifting path is gone). One metric control governs the
// per-exercise chart, the all-lifts list and the records card; volume keeps its
// own range inside its card.
import { useState } from 'react'
import SegmentedControl from '../../components/SegmentedControl'
import ExerciseProgressSection from '../progress/ExerciseProgressSection'
import StrengthProgressSection from '../progress/StrengthProgressSection'
import VolumeSection from '../progress/VolumeSection'
import PersonalRecordsSection from '../progress/PersonalRecordsSection'
import { LIFT_METRICS, type LiftMetric } from '../progress/lifting'

export default function LiftingProgress() {
  const [liftMetric, setLiftMetric] = useState<LiftMetric>('heaviest')
  const [liftExerciseId, setLiftExerciseId] = useState<string | null>(null)

  return (
    <div className="space-y-4">
      <SegmentedControl
        size="sm"
        options={LIFT_METRICS.map((m) => ({ key: m.key, label: m.label }))}
        value={liftMetric}
        onChange={setLiftMetric}
        ariaLabel="Lift metric"
      />
      <ExerciseProgressSection metric={liftMetric} exerciseId={liftExerciseId} onSelectExercise={setLiftExerciseId} />
      <StrengthProgressSection
        metric={liftMetric}
        range="all"
        activeExerciseId={liftExerciseId}
        onSelectExercise={setLiftExerciseId}
      />
      <VolumeSection />
      <PersonalRecordsSection onSelectExercise={setLiftExerciseId} />
    </div>
  )
}

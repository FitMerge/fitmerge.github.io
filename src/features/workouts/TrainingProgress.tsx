// The training-progress surface, folded onto the Train tab from what used to be
// Progress > Lifting and Progress > Cardio. Lifting first ("is the bar going
// up"), cardio below. Kept as its own component so the Workouts home stays about
// starting and planning sessions, while this stays about reading trends.
import { useState } from 'react'
import SegmentedControl from '../../components/SegmentedControl'
import ExerciseProgressSection from '../progress/ExerciseProgressSection'
import StrengthProgressSection from '../progress/StrengthProgressSection'
import VolumeSection from '../progress/VolumeSection'
import PersonalRecordsSection from '../progress/PersonalRecordsSection'
import ActiveTimeSection from '../progress/ActiveTimeSection'
import CardioDashboard from './CardioDashboard'
import { LIFT_METRICS, type LiftMetric } from '../progress/lifting'

type Discipline = 'lifting' | 'cardio'

const DISCIPLINE_OPTIONS = [
  { key: 'lifting' as const, label: 'Lifting' },
  { key: 'cardio' as const, label: 'Cardio' },
]

export default function TrainingProgress({ initialDiscipline = 'lifting' }: { initialDiscipline?: Discipline }) {
  const [discipline, setDiscipline] = useState<Discipline>(initialDiscipline)
  // The lifting view is built around one question — "how is THIS lift going" — so
  // the exercise and the metric are page-level state shared by the chart, the
  // all-lifts list and the records card.
  const [liftMetric, setLiftMetric] = useState<LiftMetric>('heaviest')
  const [liftExerciseId, setLiftExerciseId] = useState<string | null>(null)

  return (
    <div className="space-y-4">
      <SegmentedControl
        options={DISCIPLINE_OPTIONS}
        value={discipline}
        onChange={setDiscipline}
        ariaLabel="Training discipline"
      />

      {discipline === 'lifting' && (
        <div className="space-y-4">
          {/* The one control that governs the page. Volume keeps its own range
              inside its card, so there are never two unlabelled pickers here. */}
          <SegmentedControl
            size="sm"
            options={LIFT_METRICS.map((m) => ({ key: m.key, label: m.label }))}
            value={liftMetric}
            onChange={setLiftMetric}
            ariaLabel="Lift metric"
          />

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

      {discipline === 'cardio' && (
        <div className="space-y-4">
          <ActiveTimeSection />
          <CardioDashboard />
        </div>
      )}
    </div>
  )
}

import { describe, it, expect, beforeEach } from 'vitest'
import { useWorkoutsStore } from './workouts'
import { isCardioSession } from '../features/workouts/cardio'
import { estimateSessionCalories } from '../lib/exercise'

describe('logActivity', () => {
  beforeEach(() => {
    useWorkoutsStore.setState({ sessions: [] })
  })

  it('creates a finished, session-shaped activity that reads as cardio', () => {
    useWorkoutsStore.getState().logActivity({ name: 'Yoga', date: '2026-08-15', durationMin: 45, kcal: 150 })
    const [s] = useWorkoutsStore.getState().sessions
    expect(s.name).toBe('Yoga')
    expect(s.date).toBe('2026-08-15')
    expect(s.durationMin).toBe(45)
    expect(s.kcal).toBe(150)
    expect(s.finishedAt).toBeGreaterThan(s.startedAt)
    expect(s.entries).toEqual([])
    // No strength sets → it flows into the cardio/activity views.
    expect(isCardioSession(s)).toBe(true)
  })

  it('feeds the day calorie burn using the reported kcal', () => {
    useWorkoutsStore.getState().logActivity({ name: 'Trail run', date: '2026-08-15', durationMin: 30, kcal: 320 })
    const [s] = useWorkoutsStore.getState().sessions
    expect(estimateSessionCalories(s, 75)).toBe(320)
  })

  it('anchors finishedAt to duration from local noon on the chosen date', () => {
    useWorkoutsStore.getState().logActivity({ name: 'Hike', date: '2026-08-15', durationMin: 90 })
    const [s] = useWorkoutsStore.getState().sessions
    const noon = new Date(2026, 7, 15, 12).getTime()
    expect(s.startedAt).toBe(noon)
    expect(s.finishedAt).toBe(noon + 90 * 60000)
  })

  it('omits zero/blank optional fields but still logs the activity', () => {
    useWorkoutsStore.getState().logActivity({ name: 'Stretching', date: '2026-08-15' })
    const [s] = useWorkoutsStore.getState().sessions
    expect(s.durationMin).toBeUndefined()
    expect(s.kcal).toBeUndefined()
    expect(s.distanceKm).toBeUndefined()
    expect(s.name).toBe('Stretching')
  })

  it('carries an optional distance through', () => {
    useWorkoutsStore.getState().logActivity({ name: 'Run', date: '2026-08-15', durationMin: 25, distanceKm: 5 })
    const [s] = useWorkoutsStore.getState().sessions
    expect(s.distanceKm).toBe(5)
  })
})

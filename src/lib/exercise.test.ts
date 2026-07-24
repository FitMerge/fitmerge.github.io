import { describe, expect, it } from 'vitest'
import { burnedCaloriesForDate, estimateSessionCalories, latestBodyWeightKg } from './exercise'
import type { BodyEntry, ExerciseEntry, WorkoutSession } from '../types'

const DATE = '2026-01-15'

const session = (over: Partial<WorkoutSession> = {}): WorkoutSession => ({
  id: 'w1',
  name: 'Session',
  date: DATE,
  startedAt: 0,
  entries: [],
  ...over,
})

describe('latestBodyWeightKg', () => {
  it('defaults to 75kg with no entries', () => {
    expect(latestBodyWeightKg([])).toBe(75)
  })

  it('picks the most recent date regardless of array order', () => {
    const entries: BodyEntry[] = [
      { date: '2026-01-01', weightKg: 80 },
      { date: '2026-02-01', weightKg: 78 },
      { date: '2026-01-15', weightKg: 79 },
    ]
    expect(latestBodyWeightKg(entries)).toBe(78)
  })

  it('falls back to the default when the latest entry has no usable weight', () => {
    expect(latestBodyWeightKg([{ date: '2026-01-01', weightKg: 0 }])).toBe(75)
  })

  it('does not mutate the caller array', () => {
    const entries: BodyEntry[] = [
      { date: '2026-01-01', weightKg: 80 },
      { date: '2026-02-01', weightKg: 78 },
    ]
    latestBodyWeightKg(entries)
    expect(entries[0].date).toBe('2026-01-01')
  })
})

describe('estimateSessionCalories', () => {
  it('is zero for an unfinished session', () => {
    expect(estimateSessionCalories(session(), 80)).toBe(0)
  })

  it('trusts a reported calorie count', () => {
    expect(estimateSessionCalories(session({ finishedAt: 1, kcal: 250.4 }), 80)).toBe(250)
  })

  it('estimates from duration at MET 5 when calories are missing', () => {
    // 5 MET x 80kg x 60min / 60
    expect(estimateSessionCalories(session({ finishedAt: 1, durationMin: 60 }), 80)).toBe(400)
  })

  it('derives duration from the start/finish timestamps', () => {
    expect(estimateSessionCalories(session({ startedAt: 0, finishedAt: 1_800_000 }), 80)).toBe(200)
  })

  it('is zero without a usable bodyweight', () => {
    expect(estimateSessionCalories(session({ finishedAt: 1, durationMin: 60 }), 0)).toBe(0)
  })
})

describe('burnedCaloriesForDate', () => {
  const manual: Record<string, ExerciseEntry[]> = {
    [DATE]: [
      { id: 'e1', name: 'Walk', calories: 120 },
      { id: 'e2', name: 'Cycle', calories: 80 },
    ],
  }

  it('adds manual entries to finished workouts', () => {
    const sessions = [session({ finishedAt: 1, kcal: 300 })]
    expect(burnedCaloriesForDate(DATE, manual, sessions, 80)).toBe(500)
  })

  it('ignores unfinished sessions and sessions on other dates', () => {
    const sessions = [
      session({ id: 'a', kcal: 300 }), // never finished
      session({ id: 'b', date: '2026-01-14', finishedAt: 1, kcal: 300 }),
    ]
    expect(burnedCaloriesForDate(DATE, manual, sessions, 80)).toBe(200)
  })

  it('is zero for a date with nothing logged', () => {
    expect(burnedCaloriesForDate('2026-02-02', manual, [], 80)).toBe(0)
  })
})

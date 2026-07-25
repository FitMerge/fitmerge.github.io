import { describe, expect, it } from 'vitest'
import { activityCategory, cardioActivities, cardioSeries, formatPace } from './cardio'
import type { WorkoutSession } from '../../types'

const session = (over: Partial<WorkoutSession> = {}): WorkoutSession => ({
  id: 'w1',
  name: 'Denver Running',
  date: '2026-01-15',
  startedAt: 0,
  finishedAt: 1,
  durationMin: 30,
  entries: [],
  ...over,
})

describe('activityCategory', () => {
  it('ignores the city Garmin prefixes onto every activity', () => {
    expect(activityCategory('Denver Running')).toBe('Run')
    expect(activityCategory('Arvada Running')).toBe('Run')
    expect(activityCategory('Golden Running')).toBe('Run')
  })

  it('ignores the equipment suffix too', () => {
    expect(activityCategory('Treadmill Running')).toBe('Run')
    expect(activityCategory('Indoor Cycling')).toBe('Bike')
    expect(activityCategory('Trail Running')).toBe('Run')
  })

  it.each([
    ['Denver Walking', 'Walk'],
    ['Nordic Walking', 'Walk'],
    ['Hiking', 'Hike'],
    ['Boulder Hiking', 'Hike'],
    ['Mountain Biking', 'Bike'],
    ['Road Cycling', 'Bike'],
    ['eBike Ride', 'Bike'],
    ['Backcountry Skiing', 'Ski'],
    ['Resort Snowboarding', 'Ski'],
    ['Strength Training', 'Strength'],
    ['Weight Lifting', 'Strength'],
  ])('maps %s to %s', (name, expected) => {
    expect(activityCategory(name)).toBe(expected)
  })

  it('treats snowshoeing as a hike rather than a ski', () => {
    // Both patterns could plausibly claim it; ordering decides.
    expect(activityCategory('Snowshoeing')).toBe('Hike')
  })

  it('falls back to Other for sports outside the major categories', () => {
    expect(activityCategory('Pool Swim')).toBe('Other')
    expect(activityCategory('Yoga')).toBe('Other')
    expect(activityCategory('Cardio')).toBe('Other')
  })
})

describe('cardioActivities', () => {
  it('collapses differently-named sessions of the same sport into one entry', () => {
    const activities = cardioActivities([
      session({ id: 'a', name: 'Denver Running' }),
      session({ id: 'b', name: 'Arvada Running' }),
      session({ id: 'c', name: 'Treadmill Running' }),
      session({ id: 'd', name: 'Denver Walking' }),
    ])
    expect(activities).toHaveLength(2)
    expect(activities[0]).toMatchObject({ category: 'Run', count: 3 })
    expect(activities[1]).toMatchObject({ category: 'Walk', count: 1 })
  })

  it('reports distance as available when any session in the category has it', () => {
    const activities = cardioActivities([
      session({ id: 'a', name: 'Denver Running' }),
      session({ id: 'b', name: 'Arvada Running', distanceKm: 8 }),
    ])
    expect(activities[0].hasDistance).toBe(true)
  })

  it('has no distance when nothing in the category recorded any', () => {
    expect(cardioActivities([session()])[0].hasDistance).toBe(false)
  })

  it('ignores sessions with logged strength sets', () => {
    const lifted = session({
      id: 'x',
      name: 'Push Day',
      entries: [{ exerciseId: 'bench', sets: [{ weight: 60, reps: 5, done: true }] }],
    })
    expect(cardioActivities([lifted])).toEqual([])
  })
})

describe('cardioSeries', () => {
  it('pulls every session in a category regardless of its name', () => {
    const points = cardioSeries(
      [
        session({ id: 'a', name: 'Denver Running', date: '2026-01-10', distanceKm: 5 }),
        session({ id: 'b', name: 'Treadmill Running', date: '2026-01-12', distanceKm: 5 }),
        session({ id: 'c', name: 'Denver Walking', date: '2026-01-11' }),
      ],
      'Run',
      'metric',
    )
    expect(points).toHaveLength(2)
    expect(points.map((p) => p.date)).toEqual(['2026-01-10', '2026-01-12'])
  })

  it('computes pace in the display unit', () => {
    // 30 minutes over 5km = 6 min/km
    const [point] = cardioSeries([session({ distanceKm: 5, durationMin: 30 })], 'Run', 'metric')
    expect(point.pace).toBeCloseTo(6, 6)
  })

  it('leaves pace null when the session has no distance', () => {
    const [point] = cardioSeries([session()], 'Run', 'metric')
    expect(point.pace).toBeNull()
    expect(point.distance).toBeNull()
  })
})

describe('formatPace', () => {
  it('renders decimal minutes as m:ss', () => {
    expect(formatPace(6)).toBe('6:00')
    expect(formatPace(6.5)).toBe('6:30')
    expect(formatPace(7.25)).toBe('7:15')
  })

  it('carries a rounded 60 seconds into the next minute', () => {
    expect(formatPace(5.999)).toBe('6:00')
  })
})

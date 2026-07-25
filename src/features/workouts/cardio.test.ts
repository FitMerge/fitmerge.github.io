import { describe, expect, it } from 'vitest'
import {
  activityCategory,
  cardioActivities,
  cardioSeries,
  formatPace,
  hasOutlierSpike,
  inCardioRange,
} from './cardio'
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

describe('inCardioRange', () => {
  const TODAY = '2026-07-24'

  it('includes today and the full window, excluding the day before it', () => {
    const range = { kind: 'days', days: 30 } as const
    expect(inCardioRange(TODAY, range, TODAY)).toBe(true)
    expect(inCardioRange('2026-06-25', range, TODAY)).toBe(true) // 30th day back
    expect(inCardioRange('2026-06-24', range, TODAY)).toBe(false) // 31st
  })

  it('excludes dates in the future', () => {
    expect(inCardioRange('2026-08-01', { kind: 'days', days: 30 }, TODAY)).toBe(false)
  })

  it('keeps everything for the all-time range', () => {
    expect(inCardioRange('2019-01-01', { kind: 'all' }, TODAY)).toBe(true)
  })

  it('honours a custom window inclusively at both ends', () => {
    const range = { kind: 'custom', from: '2026-03-01', to: '2026-03-31' } as const
    expect(inCardioRange('2026-03-01', range, TODAY)).toBe(true)
    expect(inCardioRange('2026-03-31', range, TODAY)).toBe(true)
    expect(inCardioRange('2026-02-28', range, TODAY)).toBe(false)
    expect(inCardioRange('2026-04-01', range, TODAY)).toBe(false)
  })

  it('tolerates a custom window entered back to front', () => {
    const backwards = { kind: 'custom', from: '2026-03-31', to: '2026-03-01' } as const
    expect(inCardioRange('2026-03-15', backwards, TODAY)).toBe(true)
  })
})

describe('range filtering', () => {
  const TODAY = '2026-07-24'

  const runs = [
    session({ id: 'a', name: 'Denver Running', date: '2026-07-20', distanceKm: 5 }),
    session({ id: 'b', name: 'Arvada Running', date: '2026-05-01', distanceKm: 6 }),
    session({ id: 'c', name: 'Denver Running', date: '2025-01-01', distanceKm: 7 }),
  ]

  it('counts only sessions inside the range', () => {
    const last30 = cardioActivities(runs, { kind: 'days', days: 30 }, TODAY)
    expect(last30[0]).toMatchObject({ category: 'Run', count: 1 })

    const allTime = cardioActivities(runs, { kind: 'all' }, TODAY)
    expect(allTime[0]).toMatchObject({ category: 'Run', count: 3 })
  })

  it('drops a category entirely when it has nothing in range', () => {
    // A 2-day window ends 2026-07-23, just past the most recent run on the 20th.
    expect(cardioActivities(runs, { kind: 'days', days: 2 }, TODAY)).toEqual([])
  })

  it('charts only the sessions the count is describing', () => {
    const range = { kind: 'days', days: 90 } as const
    const activities = cardioActivities(runs, range, TODAY)
    const points = cardioSeries(runs, 'Run', 'metric', range, TODAY)
    // The tab count and the plotted series must agree, or the UI lies.
    expect(points).toHaveLength(activities[0].count)
    expect(points).toHaveLength(2)
  })
})

describe('hasOutlierSpike', () => {
  it('spots a half marathon hiding among a season of 5k runs', () => {
    expect(hasOutlierSpike([5, 5.2, 4.8, 5.1, 5, 21.1])).toBe(true)
  })

  it('leaves consistent training alone', () => {
    expect(hasOutlierSpike([5, 5.2, 4.8, 5.1, 6, 4.5])).toBe(false)
  })

  it('tolerates a steady build without calling it a spike', () => {
    // Marathon block ramping 5k to 12k — real progression, not an outlier.
    expect(hasOutlierSpike([5, 6, 7, 8, 9, 10, 11, 12])).toBe(false)
  })

  it('needs enough history to call anything typical', () => {
    expect(hasOutlierSpike([5, 21])).toBe(false)
    expect(hasOutlierSpike([5, 5, 21])).toBe(false)
  })

  it('ignores gaps and non-positive values', () => {
    expect(hasOutlierSpike([5, null, 5, null, 5, 5, 21])).toBe(true)
    expect(hasOutlierSpike([null, null])).toBe(false)
    expect(hasOutlierSpike([0, 0, 0, 0])).toBe(false)
  })

  it('measures against the median so the spike cannot inflate its own baseline', () => {
    // The mean of these is dragged up past 2.5x by the outlier itself; the median
    // is not, so the spike is still correctly identified.
    expect(hasOutlierSpike([4, 4, 4, 4, 4, 4, 4, 40])).toBe(true)
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

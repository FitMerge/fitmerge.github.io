import { describe, expect, it } from 'vitest'
import {
  activityCategory,
  cardioActivities,
  cardioSeries,
  bestEfforts,
  formatDuration,
  formatGarminRecord,
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

describe('bestEfforts', () => {
  const TODAY = '2026-07-24'
  const ALL = { kind: 'all' } as const

  it('picks the fastest session at each standard distance', () => {
    const efforts = bestEfforts(
      [
        session({ id: 'a', date: '2026-07-01', distanceKm: 5, durationMin: 26 }),
        session({ id: 'b', date: '2026-07-08', distanceKm: 5, durationMin: 24 }), // faster
        session({ id: 'c', date: '2026-07-15', distanceKm: 10, durationMin: 52 }),
      ],
      'Run',
      'metric',
      ALL,
      TODAY,
    )
    expect(efforts.map((e) => e.label)).toEqual(['5K', '10K'])
    expect(efforts[0].durationMin).toBe(24)
    expect(efforts[0].date).toBe('2026-07-08')
  })

  it('ranks on pace, so a longer run does not win on elapsed time alone', () => {
    // 5.25km in 25min is 4:45/km; 4.75km in 24min is 5:03/km. The slower pace has
    // the shorter clock, and must not be crowned.
    const efforts = bestEfforts(
      [
        session({ id: 'long', date: '2026-07-01', distanceKm: 5.25, durationMin: 25 }),
        session({ id: 'short', date: '2026-07-08', distanceKm: 4.75, durationMin: 24 }),
      ],
      'Run',
      'metric',
      ALL,
      TODAY,
    )
    expect(efforts[0].date).toBe('2026-07-01')
  })

  it('ignores sessions outside the distance tolerance', () => {
    // 5.5km is 10% over — a 5k PB should not be claimed from it.
    const efforts = bestEfforts(
      [session({ id: 'a', date: '2026-07-01', distanceKm: 5.5, durationMin: 25 })],
      'Run',
      'metric',
      ALL,
      TODAY,
    )
    expect(efforts).toEqual([])
  })

  it('recognises a half marathon and a marathon', () => {
    const efforts = bestEfforts(
      [
        session({ id: 'h', date: '2026-05-01', distanceKm: 21.1, durationMin: 115 }),
        session({ id: 'm', date: '2026-06-01', distanceKm: 42.2, durationMin: 245 }),
      ],
      'Run',
      'metric',
      ALL,
      TODAY,
    )
    expect(efforts.map((e) => e.label)).toEqual(['Half', 'Marathon'])
  })

  it('only considers the requested sport', () => {
    const efforts = bestEfforts(
      [session({ id: 'ride', name: 'Road Cycling', date: '2026-07-01', distanceKm: 5, durationMin: 12 })],
      'Run',
      'metric',
      ALL,
      TODAY,
    )
    expect(efforts).toEqual([])
  })

  it('respects the selected range', () => {
    const runs = [session({ id: 'old', date: '2025-01-01', distanceKm: 5, durationMin: 22 })]
    expect(bestEfforts(runs, 'Run', 'metric', ALL, TODAY)).toHaveLength(1)
    expect(bestEfforts(runs, 'Run', 'metric', { kind: 'days', days: 30 }, TODAY)).toEqual([])
  })

  it('reports pace in the display unit', () => {
    const [effort] = bestEfforts(
      [session({ id: 'a', date: '2026-07-01', distanceKm: 5, durationMin: 25 })],
      'Run',
      'imperial',
      ALL,
      TODAY,
    )
    // 5km is 3.107mi, so 25 minutes is about 8:03 per mile — not 5:00.
    expect(effort.pace).toBeCloseTo(25 / (5 / 1.60934), 6)
  })

  it('skips sessions missing distance or duration', () => {
    const efforts = bestEfforts(
      [
        session({ id: 'a', date: '2026-07-01', distanceKm: 5, durationMin: 0 }),
        session({ id: 'b', date: '2026-07-02', durationMin: 25 }),
      ],
      'Run',
      'metric',
      ALL,
      TODAY,
    )
    expect(efforts).toEqual([])
  })
})

describe('formatGarminRecord', () => {
  it('renders a time record as a clock', () => {
    // Garmin reports seconds; 1355s is a 22:35 5K.
    expect(formatGarminRecord({ typeId: 3, label: 'Fastest 5K', kind: 'time', value: 1355 }, 'metric')).toBe(
      '22:35',
    )
  })

  it('renders a long time record with hours', () => {
    expect(
      formatGarminRecord({ typeId: 5, label: 'Fastest half', kind: 'time', value: 6837.9 }, 'metric'),
    ).toBe('1:53:58')
  })

  it('converts a distance record from metres into the display unit', () => {
    const record = { typeId: 7, label: 'Longest run', kind: 'distance', value: 74701.5 } as const
    expect(formatGarminRecord(record, 'metric')).toBe('74.7 km')
    expect(formatGarminRecord(record, 'imperial')).toBe('46.4 mi')
  })
})

describe('formatDuration', () => {
  it('renders under an hour as m:ss', () => {
    expect(formatDuration(24)).toBe('24:00')
    expect(formatDuration(24.5)).toBe('24:30')
  })

  it('switches to h:mm:ss past an hour', () => {
    expect(formatDuration(115)).toBe('1:55:00')
    expect(formatDuration(245.5)).toBe('4:05:30')
  })

  it('rolls 60 rounded seconds into the next minute', () => {
    expect(formatDuration(24.999)).toBe('25:00')
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

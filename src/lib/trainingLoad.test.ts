import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  acwr,
  dailyLoadByDate,
  formState,
  hasRealTrainingLoad,
  performanceManagementChart,
  sessionLoad,
} from './trainingLoad'
import { addDays } from './date'
import type { WorkoutSession } from '../types'

const TODAY = '2026-01-15'

const session = (over: Partial<WorkoutSession> = {}): WorkoutSession => ({
  id: 'w1',
  name: 'Session',
  date: TODAY,
  startedAt: 0,
  entries: [],
  ...over,
})

beforeEach(() => {
  vi.useFakeTimers()
  // Built from local components so the ISO date helpers — which read local time —
  // land on TODAY whatever timezone the runner is in.
  vi.setSystemTime(new Date(2026, 0, 15, 12, 0, 0))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('sessionLoad', () => {
  it("prefers Garmin's native training load over every estimate", () => {
    expect(sessionLoad(session({ trainingLoad: 120, kcal: 600, durationMin: 60 }))).toBe(120)
  })

  it('estimates from calories when no training load is present', () => {
    expect(sessionLoad(session({ kcal: 600, durationMin: 45 }))).toBe(100)
  })

  it('falls back to duration in minutes', () => {
    expect(sessionLoad(session({ durationMin: 45 }))).toBe(45)
  })

  it('is zero when the session carries no load signal at all', () => {
    expect(sessionLoad(session())).toBe(0)
  })
})

describe('hasRealTrainingLoad', () => {
  it('is true only when some session carries a positive training load', () => {
    expect(hasRealTrainingLoad([session({ kcal: 600 })])).toBe(false)
    expect(hasRealTrainingLoad([session({ trainingLoad: 0 })])).toBe(false)
    expect(hasRealTrainingLoad([session({ kcal: 600 }), session({ trainingLoad: 80 })])).toBe(true)
  })
})

describe('dailyLoadByDate', () => {
  it('sums every session landing on the same date', () => {
    const loads = dailyLoadByDate([
      session({ id: 'a', kcal: 600 }),
      session({ id: 'b', kcal: 300 }),
    ])
    expect(loads.get(TODAY)).toBe(150)
  })

  it('skips sessions with no date or no load', () => {
    const loads = dailyLoadByDate([session({ date: '' }), session({ id: 'b', kcal: 0 })])
    expect(loads.size).toBe(0)
  })
})

describe('performanceManagementChart', () => {
  it('returns nothing without any load history', () => {
    expect(performanceManagementChart([])).toEqual([])
  })

  it('emits one point per day from the first activity through today', () => {
    const pmc = performanceManagementChart([session({ date: addDays(TODAY, -3), kcal: 600 })])
    expect(pmc).toHaveLength(4)
    expect(pmc[0].date).toBe(addDays(TODAY, -3))
    expect(pmc[pmc.length - 1].date).toBe(TODAY)
  })

  it('moves fatigue faster than fitness for the same load', () => {
    const [day] = performanceManagementChart([session({ kcal: 600 })])
    expect(day.load).toBe(100)
    expect(day.ctl).toBeCloseTo(100 * (1 - Math.exp(-1 / 42)), 10)
    expect(day.atl).toBeCloseTo(100 * (1 - Math.exp(-1 / 7)), 10)
    expect(day.atl).toBeGreaterThan(day.ctl)
  })

  it("reports TSB as the prior day's fitness minus fatigue", () => {
    const pmc = performanceManagementChart([
      session({ id: 'a', date: addDays(TODAY, -1), kcal: 600 }),
      session({ id: 'b', kcal: 600 }),
    ])
    expect(pmc[0].tsb).toBe(0) // nothing accrued before the first day
    expect(pmc[1].tsb).toBeCloseTo(pmc[0].ctl - pmc[0].atl, 10)
  })

  it('carries rest days through as zero load', () => {
    const pmc = performanceManagementChart([session({ date: addDays(TODAY, -2), kcal: 600 })])
    expect(pmc[1].load).toBe(0)
    expect(pmc[1].atl).toBeLessThan(pmc[0].atl) // fatigue decays on a rest day
  })
})

describe('acwr', () => {
  it('returns null without load history', () => {
    expect(acwr([])).toBeNull()
  })

  it('flags a spike when all the load is crammed into the last week', () => {
    const ratio = acwr([session({ kcal: 600 })])
    expect(ratio?.acute).toBe(100)
    expect(ratio?.chronic).toBe(25) // 100 over 28 days, expressed weekly
    expect(ratio?.ratio).toBe(4)
    expect(ratio?.level).toBe('danger')
  })

  it('sits in the sweet spot when load is even across 28 days', () => {
    const sessions = Array.from({ length: 28 }, (_, i) =>
      session({ id: `w${i}`, date: addDays(TODAY, -i), kcal: 600 }),
    )
    const ratio = acwr(sessions)
    expect(ratio?.ratio).toBeCloseTo(1, 10)
    expect(ratio?.level).toBe('optimal')
  })

  it('returns null when every session predates the 28-day window', () => {
    expect(acwr([session({ date: addDays(TODAY, -40), kcal: 600 })])).toBeNull()
  })
})

describe('formState', () => {
  it.each([
    [16, 'Fresh / detraining'],
    [15, 'Fresh'],
    [6, 'Fresh'],
    [5, 'Neutral'],
    [-10, 'Neutral'],
    [-11, 'Productive'],
    [-30, 'Productive'],
    [-31, 'Overreaching'],
  ])('maps a TSB of %s to "%s"', (tsb, label) => {
    expect(formState(tsb).label).toBe(label)
  })
})

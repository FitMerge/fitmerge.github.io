import { describe, expect, it } from 'vitest'
import {
  challengeDates,
  challengeLength,
  currentPeriod,
  dayIndex,
  daysLogged,
  isActive,
  normalizedWeights,
  perfectDays,
  periodOf,
  periodRange,
  rankOf,
  scoreAll,
  scoreDay,
  standings,
  sumPoints,
  type Challenge,
  type ScoreDays,
} from './scoring'
import { equalSplit } from './weights'

function challenge(patch: Partial<Challenge> = {}): Challenge {
  return {
    code: 'AB34CD78',
    name: 'Iron Month',
    ownerUid: 'josh',
    startDate: '2026-08-01',
    endDate: '2026-08-30',
    periodDays: 0,
    bonusPct: 0.1,
    ...patch,
  }
}

/** `done` predicate over a plain list of completed habit ids. */
function doneIn(ids: string[]) {
  return (habitId: string) => ids.includes(habitId)
}

describe('scoreDay', () => {
  const c = challenge()
  const three = { a: 34, b: 33, c: 33 }

  it('scores nothing done as zero, with no bonus', () => {
    expect(scoreDay(c, three, doneIn([]))).toEqual({ done: 0, total: 3, points: 0 })
  })

  it('scores partial days by the weight of what was completed', () => {
    expect(scoreDay(c, three, doneIn(['b']))).toEqual({ done: 1, total: 3, points: 33 })
    expect(scoreDay(c, three, doneIn(['b', 'c']))).toEqual({ done: 2, total: 3, points: 66 })
  })

  it('adds the 10% bonus only for a fully completed day', () => {
    expect(scoreDay(c, three, doneIn(['a', 'b', 'c']))).toEqual({ done: 3, total: 3, points: 110 })
  })

  // The premise of the whole feature: different habit lists stay comparable
  // because the weights are percentages of one shared day value.
  it('scores a perfect day the same regardless of how many habits were chosen', () => {
    const threeHabits = equalSplit(['a', 'b', 'c'])
    const sixHabits = equalSplit(['a', 'b', 'c', 'd', 'e', 'f'])
    const perfect3 = scoreDay(c, threeHabits, () => true)
    const perfect6 = scoreDay(c, sixHabits, () => true)
    expect(perfect3.points).toBe(110)
    expect(perfect6.points).toBe(110)
  })

  it('honours hand-tuned weights', () => {
    // Josh's example: two workouts and diet at 20%, water 10%, the rest at 5%.
    const weights = { workout1: 20, workout2: 20, diet: 20, water: 10, reading: 5, weighin: 5, photo: 20 }
    expect(scoreDay(c, weights, doneIn(['workout1', 'workout2'])).points).toBe(40)
    expect(scoreDay(c, weights, doneIn(['reading', 'weighin'])).points).toBe(10)
  })

  it('gives an empty commitment no points and no bonus', () => {
    // Without the `total > 0` guard every habit is vacuously complete and this
    // would quietly earn the perfect-day bonus every single day.
    expect(scoreDay(c, {}, () => true)).toEqual({ done: 0, total: 0, points: 0 })
  })

  it('scores a perfect day as exactly the day value when the bonus is off', () => {
    expect(scoreDay(challenge({ bonusPct: 0 }), three, () => true).points).toBe(100)
  })

  it('normalizes weights that do not total 100 rather than trusting them', () => {
    // A half-finished edit must never buy a 200-point day.
    const over = { a: 100, b: 100 }
    expect(scoreDay(c, over, doneIn(['a'])).points).toBe(50)
    expect(scoreDay(c, over, () => true).points).toBe(110)

    const under = { a: 10, b: 10 }
    expect(scoreDay(c, under, doneIn(['a'])).points).toBe(50)
  })

  it('falls back to an equal split when every weight is zero', () => {
    expect(scoreDay(c, { a: 0, b: 0 }, doneIn(['a'])).points).toBe(50)
  })
})

describe('normalizedWeights', () => {
  it('scales to the day value while keeping proportions', () => {
    const out = normalizedWeights({ a: 1, b: 3 })
    expect(out.a).toBeCloseTo(25)
    expect(out.b).toBeCloseTo(75)
  })

  it('ignores negative weights instead of subtracting from the day', () => {
    const out = normalizedWeights({ a: -50, b: 50 })
    expect(out.a).toBe(0)
    expect(out.b).toBeCloseTo(100)
  })

  it('returns nothing for an empty selection', () => {
    expect(normalizedWeights({})).toEqual({})
  })
})

describe('challengeDates', () => {
  it('covers the challenge inclusively', () => {
    const c = challenge({ startDate: '2026-08-01', endDate: '2026-08-05' })
    expect(challengeDates(c, '2026-12-01')).toEqual([
      '2026-08-01',
      '2026-08-02',
      '2026-08-03',
      '2026-08-04',
      '2026-08-05',
    ])
  })

  it('stops at today, so a wrong clock cannot bank days that have not happened', () => {
    const c = challenge({ startDate: '2026-08-01', endDate: '2027-08-01' })
    expect(challengeDates(c, '2026-08-03')).toEqual(['2026-08-01', '2026-08-02', '2026-08-03'])
  })

  it('returns nothing before the challenge starts', () => {
    expect(challengeDates(challenge(), '2026-07-31')).toEqual([])
  })

  it('crosses a month boundary correctly', () => {
    const c = challenge({ startDate: '2026-01-30', endDate: '2026-02-02' })
    expect(challengeDates(c, '2026-03-01')).toEqual(['2026-01-30', '2026-01-31', '2026-02-01', '2026-02-02'])
  })
})

describe('dayIndex', () => {
  it('is zero-based from the start date', () => {
    const c = challenge({ startDate: '2026-08-01', endDate: '2026-08-30' })
    expect(dayIndex(c, '2026-08-01')).toBe(0)
    expect(dayIndex(c, '2026-08-02')).toBe(1)
    expect(dayIndex(c, '2026-08-30')).toBe(29)
  })

  it('reports -1 outside the challenge', () => {
    const c = challenge({ startDate: '2026-08-01', endDate: '2026-08-30' })
    expect(dayIndex(c, '2026-07-31')).toBe(-1)
    expect(dayIndex(c, '2026-08-31')).toBe(-1)
  })

  // Naive local-Date millisecond division is off by an hour twice a year and
  // floors to the wrong day; this is the case that catches it.
  it('stays consecutive across a daylight-saving transition', () => {
    // US DST starts 2026-03-08; UK 2026-03-29. Span both.
    const c = challenge({ startDate: '2026-03-05', endDate: '2026-04-02' })
    expect(dayIndex(c, '2026-03-07')).toBe(2)
    expect(dayIndex(c, '2026-03-08')).toBe(3)
    expect(dayIndex(c, '2026-03-09')).toBe(4)
    expect(dayIndex(c, '2026-03-29')).toBe(24)
    expect(dayIndex(c, '2026-03-30')).toBe(25)
  })

  it('spans a month boundary and a leap day', () => {
    const c = challenge({ startDate: '2028-02-27', endDate: '2028-03-02' })
    expect(dayIndex(c, '2028-02-29')).toBe(2)
    expect(dayIndex(c, '2028-03-01')).toBe(3)
    expect(challengeLength(c)).toBe(5)
  })
})

describe('periods', () => {
  const weekly = challenge({ startDate: '2026-08-01', endDate: '2026-08-30', periodDays: 7 })

  it('anchors weeks to the start date, not to Monday', () => {
    expect(periodOf(weekly, '2026-08-01')).toBe(0)
    expect(periodOf(weekly, '2026-08-07')).toBe(0)
    expect(periodOf(weekly, '2026-08-08')).toBe(1)
    expect(periodOf(weekly, '2026-08-15')).toBe(2)
  })

  it('keeps everything in one period when resets are off', () => {
    const none = challenge({ periodDays: 0 })
    expect(periodOf(none, '2026-08-01')).toBe(0)
    expect(periodOf(none, '2026-08-30')).toBe(0)
    expect(periodOf(none, '2026-09-01')).toBe(-1)
  })

  it('clips the final period to the finish date', () => {
    // 30 days at 7 per period = 5 periods, the last only two days long.
    expect(periodRange(weekly, 4)).toEqual({ start: '2026-08-29', end: '2026-08-30', label: 'Week 5' })
  })

  it('labels monthly periods', () => {
    const monthly = challenge({ periodDays: 28 })
    expect(periodRange(monthly, 0).label).toBe('Month 1')
  })

  it('spans the whole challenge when resets are off', () => {
    expect(periodRange(challenge({ periodDays: 0 }), 0)).toEqual({
      start: '2026-08-01',
      end: '2026-08-30',
      label: 'All time',
    })
  })

  it('clamps the current period to the challenge at both ends', () => {
    expect(currentPeriod(weekly, '2026-07-01')).toBe(0)
    expect(currentPeriod(weekly, '2026-08-10')).toBe(1)
    expect(currentPeriod(weekly, '2026-12-01')).toBe(4)
  })
})

describe('aggregation', () => {
  const days: ScoreDays = {
    '2026-08-01': { done: 3, total: 3, points: 110 },
    '2026-08-02': { done: 1, total: 3, points: 33 },
    '2026-08-03': { done: 0, total: 3, points: 0 },
    '2026-08-04': { done: 3, total: 3, points: 110 },
  }

  it('sums every day by default', () => {
    expect(sumPoints(days)).toBe(253)
  })

  it('ignores days outside the window, including stale ones', () => {
    const withStale: ScoreDays = { ...days, '2025-01-01': { done: 3, total: 3, points: 110 } }
    expect(sumPoints(withStale, '2026-08-02', '2026-08-03')).toBe(33)
    expect(sumPoints(withStale, '2026-08-01', '2026-08-04')).toBe(253)
  })

  it('counts perfect days only when every habit was done', () => {
    expect(perfectDays(days)).toBe(2)
    expect(perfectDays(days, '2026-08-02', '2026-08-03')).toBe(0)
  })

  it('does not count a zero-habit day as perfect', () => {
    expect(perfectDays({ '2026-08-01': { done: 0, total: 0, points: 0 } })).toBe(0)
  })

  it('counts days with any activity as logged', () => {
    expect(daysLogged(days)).toBe(3)
  })
})

describe('standings', () => {
  const members = {
    josh: { displayName: 'Josh', joinedAt: 100 },
    sam: { displayName: 'Sam', joinedAt: 200 },
  }
  const scores = {
    josh: { days: { '2026-08-01': { done: 3, total: 3, points: 110 } }, updatedAt: 5 },
    sam: { days: { '2026-08-01': { done: 1, total: 3, points: 33 } }, updatedAt: 6 },
  }

  it('ranks by points, highest first', () => {
    const rows = standings(members, scores, 'sam', null)
    expect(rows.map((r) => r.uid)).toEqual(['josh', 'sam'])
    expect(rows[0].points).toBe(110)
    expect(rows[1].isSelf).toBe(true)
  })

  it('breaks a points tie on perfect days', () => {
    const tied = {
      a: { days: { '2026-08-01': { done: 2, total: 2, points: 110 } } },
      b: { days: { '2026-08-01': { done: 1, total: 2, points: 60 }, '2026-08-02': { done: 1, total: 2, points: 50 } } },
    }
    const rows = standings(
      { a: { displayName: 'A', joinedAt: 1 }, b: { displayName: 'B', joinedAt: 2 } },
      tied,
      null,
      null,
    )
    expect(rows.map((r) => r.uid)).toEqual(['a', 'b'])
  })

  // Without a total order the board settles into Firestore arrival order, and
  // two friends looking at the same tie see different rankings.
  it('orders a complete tie identically regardless of input order', () => {
    const day = { '2026-08-01': { done: 1, total: 2, points: 50 } }
    const first = standings(
      { x: { displayName: 'X', joinedAt: 10 }, y: { displayName: 'Y', joinedAt: 20 } },
      { x: { days: day }, y: { days: day } },
      null,
      null,
    )
    const second = standings(
      { y: { displayName: 'Y', joinedAt: 20 }, x: { displayName: 'X', joinedAt: 10 } },
      { y: { days: day }, x: { days: day } },
      null,
      null,
    )
    expect(first.map((r) => r.uid)).toEqual(['x', 'y'])
    expect(second.map((r) => r.uid)).toEqual(first.map((r) => r.uid))
  })

  it('keeps a member who has never logged, at zero', () => {
    const rows = standings({ ...members, newbie: { displayName: 'Newbie', joinedAt: 300 } }, scores, null, null)
    expect(rows).toHaveLength(3)
    const newbie = rows.find((r) => r.uid === 'newbie')
    expect(newbie?.points).toBe(0)
  })

  it('tolerates a score document whose member document has not arrived', () => {
    const rows = standings({}, scores, null, null)
    expect(rows).toHaveLength(2)
    expect(rows[0].displayName).toBe('Someone')
  })

  it('flags a member who left', () => {
    const rows = standings({ josh: { displayName: 'Josh', joinedAt: 1, leftAt: 9 } }, {}, null, null)
    expect(rows[0].hasLeft).toBe(true)
  })

  it('applies the period window to every row', () => {
    const rows = standings(members, scores, null, { from: '2026-09-01', to: '2026-09-30' })
    expect(rows.every((r) => r.points === 0)).toBe(true)
  })
})

describe('rankOf', () => {
  it('is 1-based, and zero when the member is absent', () => {
    const rows = standings(
      { a: { displayName: 'A', joinedAt: 1 }, b: { displayName: 'B', joinedAt: 2 } },
      { a: { days: { '2026-08-01': { done: 1, total: 1, points: 110 } } } },
      null,
      null,
    )
    expect(rankOf(rows, 'a')).toBe(1)
    expect(rankOf(rows, 'b')).toBe(2)
    expect(rankOf(rows, 'nobody')).toBe(0)
    expect(rankOf(rows, null)).toBe(0)
  })
})

describe('scoreAll', () => {
  const c = challenge({ startDate: '2026-08-01', endDate: '2026-08-03' })
  const weights = { a: 50, b: 50 }

  it('scores every day up to today', () => {
    const days = scoreAll(c, weights, (date) => date === '2026-08-02', '2026-08-03')
    expect(Object.keys(days)).toEqual(['2026-08-01', '2026-08-02', '2026-08-03'])
    expect(days['2026-08-02'].points).toBe(110)
    expect(days['2026-08-01'].points).toBe(0)
  })

  // The score push skips a write when the serialized result is unchanged, so a
  // non-deterministic result here would mean a write on every recompute.
  it('is deterministic, so the write-skip equality check holds', () => {
    const run = () => scoreAll(c, weights, (_d, habitId) => habitId === 'a', '2026-08-03')
    expect(run()).toEqual(run())
    expect(JSON.stringify(run())).toBe(JSON.stringify(run()))
  })
})

describe('isActive', () => {
  it('is false once finished or archived', () => {
    const c = challenge({ endDate: '2026-08-30' })
    expect(isActive(c, '2026-08-30')).toBe(true)
    expect(isActive(c, '2026-08-31')).toBe(false)
    expect(isActive(challenge({ archived: true }), '2026-08-01')).toBe(false)
  })
})

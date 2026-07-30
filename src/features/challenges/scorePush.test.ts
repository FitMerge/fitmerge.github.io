import { describe, expect, it } from 'vitest'
import { mergeWindow } from './useChallengeScorePush'
import type { ScoreDays } from './scoring'

// The score push only ever recomputes a trailing window and carries everything
// older forward untouched. That is what stops a habit deleted today from
// silently restating scores from weeks ago — `removeItem` rebuilds the
// supplement log without that habit, so a full recompute would lose those days.
describe('mergeWindow', () => {
  const published: ScoreDays = {
    '2026-08-01': { done: 3, total: 3, points: 110 },
    '2026-08-02': { done: 2, total: 3, points: 67 },
    '2026-08-03': { done: 3, total: 3, points: 110 },
  }

  it('keeps published days older than the window exactly as they were', () => {
    const out = mergeWindow(published, { '2026-08-03': { done: 1, total: 3, points: 33 } }, '2026-08-03')
    expect(out['2026-08-01']).toEqual({ done: 3, total: 3, points: 110 })
    expect(out['2026-08-02']).toEqual({ done: 2, total: 3, points: 67 })
  })

  it('lets the window overwrite the days it covers', () => {
    const out = mergeWindow(published, { '2026-08-03': { done: 1, total: 3, points: 33 } }, '2026-08-03')
    expect(out['2026-08-03']).toEqual({ done: 1, total: 3, points: 33 })
  })

  it('drops nothing when the window starts before every published day', () => {
    const window: ScoreDays = { '2026-08-01': { done: 0, total: 3, points: 0 } }
    const out = mergeWindow(published, window, '2026-08-01')
    // Everything published is inside the window, so only the recomputed day survives.
    expect(Object.keys(out)).toEqual(['2026-08-01'])
  })

  it('adds new days beyond what was published', () => {
    const out = mergeWindow(published, { '2026-08-04': { done: 3, total: 3, points: 110 } }, '2026-08-04')
    expect(Object.keys(out).sort()).toEqual(['2026-08-01', '2026-08-02', '2026-08-03', '2026-08-04'])
  })

  it('works from an empty publication', () => {
    const window: ScoreDays = { '2026-08-04': { done: 1, total: 2, points: 50 } }
    expect(mergeWindow({}, window, '2026-08-04')).toEqual(window)
  })

  // The push skips a write when the serialization is unchanged; an unstable
  // result here would mean a write on every recompute and a runaway loop.
  it('is deterministic for the same inputs', () => {
    const window: ScoreDays = { '2026-08-03': { done: 1, total: 3, points: 33 } }
    const a = mergeWindow(published, window, '2026-08-03')
    const b = mergeWindow(published, window, '2026-08-03')
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })
})

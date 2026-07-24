import { describe, expect, it } from 'vitest'
import { TONNAGE_MILESTONES, crossedMilestone, detectPRs, prLabel } from './prDetect'

describe('detectPRs', () => {
  const bars = { best1rm: 130, bestWeight: 95, bestVolume: 900 }

  it('ignores empty sets', () => {
    expect(detectPRs(0, 10, bars)).toEqual([])
    expect(detectPRs(100, 0, bars)).toEqual([])
  })

  it('stays silent the first time an exercise is performed', () => {
    // No history to beat — otherwise every set of a new lift fires three records.
    expect(detectPRs(100, 10, { best1rm: 0, bestWeight: 0, bestVolume: 0 })).toEqual([])
  })

  it('reports every bar a set clears', () => {
    expect(detectPRs(100, 10, bars)).toEqual([
      { kind: '1rm', value: 133 }, // Epley: 100 x (1 + 10/30)
      { kind: 'weight', value: 100 },
      { kind: 'volume', value: 1000 },
    ])
  })

  it('requires beating a bar, not matching it', () => {
    expect(detectPRs(95, 10, { best1rm: 1000, bestWeight: 95, bestVolume: 950 })).toEqual([])
  })

  it('can fire a single record without the others', () => {
    // Heavier than the weight bar, but lower volume and a worse estimated 1RM.
    expect(detectPRs(100, 1, { best1rm: 1000, bestWeight: 95, bestVolume: 950 })).toEqual([
      { kind: 'weight', value: 100 },
    ])
  })
})

describe('crossedMilestone', () => {
  it('fires when a running total crosses a threshold', () => {
    expect(crossedMilestone(9_000, 11_000)).toBe(10_000)
  })

  it('reports the highest threshold when several are cleared at once', () => {
    expect(crossedMilestone(9_000, 30_000)).toBe(25_000)
  })

  it('counts landing exactly on a threshold', () => {
    expect(crossedMilestone(9_999, 10_000)).toBe(10_000)
  })

  it('does not re-fire a threshold already passed', () => {
    expect(crossedMilestone(10_000, 20_000)).toBeNull()
  })

  it('lists milestones in ascending order', () => {
    expect(TONNAGE_MILESTONES).toEqual([...TONNAGE_MILESTONES].sort((a, b) => a - b))
  })
})

describe('prLabel', () => {
  it('has a label for every record kind', () => {
    expect(prLabel('1rm')).toBe('Estimated 1RM')
    expect(prLabel('weight')).toBe('Heaviest weight')
    expect(prLabel('volume')).toBe('Best set')
    expect(prLabel('milestone')).toBe('All-time total')
  })
})

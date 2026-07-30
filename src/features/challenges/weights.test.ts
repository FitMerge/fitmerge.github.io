import { describe, expect, it } from 'vitest'
import {
  balance,
  equalSplit,
  isBalanced,
  pruneWeights,
  remainingWeight,
  setWeight,
  toggleHabit,
  totalWeight,
} from './weights'

describe('equalSplit', () => {
  it('divides evenly when it can', () => {
    expect(equalSplit(['a', 'b'])).toEqual({ a: 50, b: 50 })
    expect(equalSplit(['a', 'b', 'c', 'd'])).toEqual({ a: 25, b: 25, c: 25, d: 25 })
  })

  // 100/3 is not a whole number; leaving it at 33/33/33 would total 99 and make
  // a perfect day worth less than everyone else's.
  it('distributes the remainder so the total is always 100', () => {
    expect(equalSplit(['a', 'b', 'c'])).toEqual({ a: 34, b: 33, c: 33 })
    expect(totalWeight(equalSplit(['a', 'b', 'c']))).toBe(100)
    expect(totalWeight(equalSplit(['a', 'b', 'c', 'd', 'e', 'f', 'g']))).toBe(100)
  })

  it('is stable for the same list', () => {
    expect(equalSplit(['x', 'y', 'z'])).toEqual(equalSplit(['x', 'y', 'z']))
  })

  it('handles an empty selection', () => {
    expect(equalSplit([])).toEqual({})
  })
})

describe('totalWeight / remainingWeight / isBalanced', () => {
  it('reports what is left to allocate', () => {
    expect(remainingWeight({ a: 20, b: 30 })).toBe(50)
    expect(remainingWeight({ a: 60, b: 60 })).toBe(-20)
    expect(remainingWeight(equalSplit(['a', 'b', 'c']))).toBe(0)
  })

  it('treats only an exact 100 across a non-empty selection as balanced', () => {
    expect(isBalanced({ a: 100 })).toBe(true)
    expect(isBalanced({ a: 99 })).toBe(false)
    expect(isBalanced({})).toBe(false)
  })
})

describe('balance', () => {
  it('rescales to exactly 100 while keeping proportions', () => {
    const out = balance({ a: 10, b: 30 })
    expect(out).toEqual({ a: 25, b: 75 })
    expect(totalWeight(out)).toBe(100)
  })

  it('always lands on 100 even when scaling produces fractions', () => {
    const out = balance({ a: 1, b: 1, c: 1 })
    expect(totalWeight(out)).toBe(100)
    expect(Object.values(out).sort()).toEqual([33, 33, 34])
  })

  it('brings an over-allocated edit back down', () => {
    const out = balance({ a: 80, b: 80, c: 40 })
    expect(totalWeight(out)).toBe(100)
    expect(out.a).toBe(out.b)
    expect(out.c).toBeLessThan(out.a)
  })

  it('falls back to an equal split when nothing is allocated', () => {
    expect(balance({ a: 0, b: 0 })).toEqual({ a: 50, b: 50 })
  })

  it('handles an empty selection', () => {
    expect(balance({})).toEqual({})
  })
})

describe('toggleHabit', () => {
  it('adds a habit and re-splits evenly', () => {
    expect(toggleHabit({ a: 50, b: 50 }, 'c')).toEqual({ a: 34, b: 33, c: 33 })
  })

  it('removes a habit and re-splits evenly', () => {
    expect(toggleHabit({ a: 34, b: 33, c: 33 }, 'c')).toEqual({ a: 50, b: 50 })
  })

  // Preserving the old numbers would leave the new habit on 0% and looking broken.
  it('never leaves a newly added habit at zero', () => {
    const out = toggleHabit({ a: 100 }, 'b')
    expect(out.b).toBeGreaterThan(0)
    expect(totalWeight(out)).toBe(100)
  })

  it('empties out when the last habit is removed', () => {
    expect(toggleHabit({ a: 100 }, 'a')).toEqual({})
  })
})

describe('setWeight', () => {
  it('sets one weight without touching the others', () => {
    expect(setWeight({ a: 50, b: 50 }, 'a', 70)).toEqual({ a: 70, b: 50 })
  })

  it('clamps to 0..100 and rounds', () => {
    expect(setWeight({ a: 50 }, 'a', -10).a).toBe(0)
    expect(setWeight({ a: 50 }, 'a', 140).a).toBe(100)
    expect(setWeight({ a: 50 }, 'a', 33.6).a).toBe(34)
  })

  it('ignores a habit that is not selected', () => {
    expect(setWeight({ a: 50 }, 'ghost', 20)).toEqual({ a: 50 })
  })
})

describe('pruneWeights', () => {
  // A habit deleted from the daily checklist would otherwise keep its share of
  // the day forever — unreachable points that make a perfect day impossible.
  it('drops weights whose habit is gone and rebalances the rest', () => {
    const out = pruneWeights({ a: 34, b: 33, c: 33 }, ['a', 'b'])
    expect(Object.keys(out).sort()).toEqual(['a', 'b'])
    expect(totalWeight(out)).toBe(100)
  })

  it('returns the same object when nothing changed', () => {
    const input = { a: 50, b: 50 }
    expect(pruneWeights(input, ['a', 'b', 'extra'])).toBe(input)
  })

  it('empties out when every habit is gone', () => {
    expect(pruneWeights({ a: 100 }, [])).toEqual({})
  })
})

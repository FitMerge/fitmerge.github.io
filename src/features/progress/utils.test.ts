import { describe, expect, it } from 'vitest'
import { epley1RM } from './utils'

describe('epley1RM', () => {
  it('adds a thirtieth of the load per rep', () => {
    expect(epley1RM(100, 10)).toBeCloseTo(133.333, 3)
    expect(epley1RM(100, 5)).toBeCloseTo(116.667, 3)
  })

  it('overestimates a true single, as Epley does by construction', () => {
    // Documenting the known quirk: a 1-rep set does not return the raw weight.
    expect(epley1RM(100, 1)).toBeCloseTo(103.333, 3)
  })

  it('returns the raw weight for a zero-rep set', () => {
    expect(epley1RM(100, 0)).toBe(100)
  })

  it('rises with both weight and reps', () => {
    expect(epley1RM(110, 5)).toBeGreaterThan(epley1RM(100, 5))
    expect(epley1RM(100, 6)).toBeGreaterThan(epley1RM(100, 5))
  })
})

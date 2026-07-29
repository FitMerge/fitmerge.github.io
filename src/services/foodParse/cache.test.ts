import { beforeEach, describe, expect, it } from 'vitest'

// The suite runs in node, and the cache is deliberately localStorage-backed so a
// remembered breakdown survives a reload. A five-line stub is a smaller price
// than a DOM environment for one module.
class MemoryStorage {
  private map = new Map<string, string>()
  getItem = (k: string): string | null => this.map.get(k) ?? null
  setItem = (k: string, v: string): void => void this.map.set(k, v)
  removeItem = (k: string): void => void this.map.delete(k)
  clear = (): void => this.map.clear()
}
globalThis.localStorage = new MemoryStorage() as unknown as Storage

const { cacheKey, forgetCached, getCached, setCached } = await import('./cache')

beforeEach(() => localStorage.clear())

describe('cacheKey', () => {
  it('treats the same meal written differently as the same meal', () => {
    // Different macros for "eggs cooked in oil" and "Eggs cooked in  oil." would
    // be the same inconsistency bug wearing a different hat.
    const canonical = cacheKey('eggs cooked in oil')
    expect(cacheKey('Eggs cooked in oil')).toBe(canonical)
    expect(cacheKey('  eggs   cooked in oil  ')).toBe(canonical)
    expect(cacheKey('eggs cooked in oil.')).toBe(canonical)
  })

  it('keeps genuinely different meals apart', () => {
    expect(cacheKey('two eggs')).not.toBe(cacheKey('three eggs'))
    // Detail added to a description must re-ask, not reuse.
    expect(cacheKey('rice')).not.toBe(cacheKey('rice, 2 cups'))
  })
})

describe('cache round trip', () => {
  it('returns the identical value for an equivalent description', () => {
    setCached('Eggs cooked in oil', [{ name: 'Eggs', calories: 180 }])
    expect(getCached('eggs cooked in  oil')).toEqual([{ name: 'Eggs', calories: 180 }])
  })

  it('misses on something never stored', () => {
    expect(getCached('pad thai')).toBeNull()
  })

  it('replaces rather than duplicates when the same meal is re-stored', () => {
    setCached('toast', [{ calories: 100 }])
    setCached('toast', [{ calories: 120 }])
    expect(getCached('toast')).toEqual([{ calories: 120 }])
  })

  it('expires an answer old enough that the model may have changed', () => {
    const now = 1_000_000_000_000
    setCached('toast', [{ calories: 100 }], now)
    const withinTtl = now + 29 * 24 * 60 * 60 * 1000
    const pastTtl = now + 31 * 24 * 60 * 60 * 1000
    expect(getCached('toast', withinTtl)).not.toBeNull()
    expect(getCached('toast', pastTtl)).toBeNull()
  })

  it('forgets on demand, so redo really does ask again', () => {
    setCached('toast', [{ calories: 100 }])
    forgetCached('TOAST')
    expect(getCached('toast')).toBeNull()
  })

  it('bounds what it keeps', () => {
    const t0 = 1_700_000_000_000
    for (let i = 0; i < 200; i++) setCached(`meal ${i}`, [{ calories: i }], t0 + i)
    const raw: unknown = JSON.parse(localStorage.getItem('fm-food-parse-cache') ?? '[]')
    expect(Array.isArray(raw) && raw.length).toBeLessThanOrEqual(80)
    // The most recent write survives the trim; the oldest does not.
    expect(getCached('meal 199', t0 + 200)).toEqual([{ calories: 199 }])
    expect(getCached('meal 0', t0 + 200)).toBeNull()
  })

  it('survives a corrupt store instead of breaking the meal you are logging', () => {
    localStorage.setItem('fm-food-parse-cache', 'not json{{')
    expect(getCached('toast')).toBeNull()
    expect(() => setCached('toast', [{ calories: 1 }])).not.toThrow()
  })
})

import { describe, expect, it } from 'vitest'
import { mergeBodyEntries, type BodySnapshot } from './storeAdapters'
import type { BodyEntry } from '../../types'

// Weigh-ins were merged by a plain union-by-date, and a union can only ADD: a
// deleted entry was indistinguishable from a date the other side had never
// seen, so every reconcile put it straight back. This is how a batch of
// synthetic test weigh-ins survived in a real account — deleting them locally
// was undone by the cloud copy within one refresh.
//
// Every test below is a two-device story, because that is where the bug lives.

const D = '2026-07-20'

function side(entries: BodyEntry[] = [], removedAt: Record<string, number> = {}): BodySnapshot {
  return { entries, removedAt }
}

function entry(at?: number, weightKg = 80, date = D): BodyEntry {
  return at === undefined ? { date, weightKg } : { date, weightKg, at }
}

function find(s: BodySnapshot, date = D): BodyEntry | undefined {
  return s.entries.find((e) => e.date === date)
}

describe('mergeBodyEntries', () => {
  it('keeps a deleted weigh-in deleted when the other device is stale', () => {
    // The exact regression: phone deleted it just now, cloud still has it.
    const merged = mergeBodyEntries(side([], { [D]: 2000 }), side([entry(1000)]))
    expect(find(merged)).toBeUndefined()
    expect(merged.removedAt[D]).toBe(2000)
  })

  it('applies a deletion that arrives from the cloud rather than locally', () => {
    const merged = mergeBodyEntries(side([entry(1000)]), side([], { [D]: 2000 }))
    expect(find(merged)).toBeUndefined()
  })

  // The mirror image matters just as much: logging again after deleting
  // elsewhere has to win too, or the fix just reverses the bug.
  it('lets a newer weigh-in beat an older deletion', () => {
    const merged = mergeBodyEntries(side([entry(3000, 81)]), side([], { [D]: 2000 }))
    expect(find(merged)?.weightKg).toBe(81)
    expect(merged.removedAt[D]).toBeUndefined()
  })

  it('lets a newer cloud weigh-in beat an older local deletion', () => {
    const merged = mergeBodyEntries(side([], { [D]: 1000 }), side([entry(2000, 82)]))
    expect(find(merged)?.weightKg).toBe(82)
  })

  it('keeps the newer weight when both sides edited the same date', () => {
    const a = side([entry(2000, 81)])
    const b = side([entry(1000, 79)])
    expect(find(mergeBodyEntries(a, b))?.weightKg).toBe(81)
    expect(find(mergeBodyEntries(b, a))?.weightKg).toBe(81)
  })

  it('prefers local on an exact tie, matching unionBy elsewhere', () => {
    const merged = mergeBodyEntries(side([entry(1000, 81)]), side([entry(1000, 79)]))
    expect(find(merged)?.weightKg).toBe(81)
  })

  describe('data written before timestamps existed', () => {
    it('keeps a cloud-only legacy entry', () => {
      const merged = mergeBodyEntries(side(), side([entry(undefined, 78)]))
      expect(find(merged)?.weightKg).toBe(78)
    })

    it('keeps a local-only legacy entry', () => {
      const merged = mergeBodyEntries(side([entry(undefined, 78)]), side())
      expect(find(merged)?.weightKg).toBe(78)
    })

    it('prefers local when both sides are legacy', () => {
      const merged = mergeBodyEntries(side([entry(undefined, 81)]), side([entry(undefined, 79)]))
      expect(find(merged)?.weightKg).toBe(81)
    })

    // The cleanup case: once one device deletes with a stamp, an unstamped
    // copy anywhere else must not resurrect the entry. This is what lets the
    // synthetic weigh-ins be removed for good.
    it('lets a stamped deletion beat unstamped legacy data', () => {
      const legacy = side([entry(undefined)])
      expect(find(mergeBodyEntries(side([], { [D]: 5000 }), legacy))).toBeUndefined()
      expect(find(mergeBodyEntries(legacy, side([], { [D]: 5000 })))).toBeUndefined()
    })

    // The Garmin job writes rows with no `at`; a same-date tombstone must win
    // even when the job re-imports after the deletion.
    it('keeps a deletion over a Garmin re-import on the same side', () => {
      const cloudAfterJob = side([entry(undefined, 80)], { [D]: 5000 })
      const merged = mergeBodyEntries(side(), cloudAfterJob)
      expect(find(merged)).toBeUndefined()
    })
  })

  describe('leaves unrelated dates alone', () => {
    it('keeps entries each device logged independently', () => {
      const merged = mergeBodyEntries(
        side([entry(1000, 80, '2026-07-19')]),
        side([entry(1000, 81, '2026-07-20')]),
      )
      expect(merged.entries.map((e) => e.date).sort()).toEqual(['2026-07-19', '2026-07-20'])
    })

    it('deleting one date does not touch its neighbours', () => {
      const merged = mergeBodyEntries(
        side([entry(1000, 80, '2026-07-19')], { '2026-07-20': 2000 }),
        side([entry(1000, 81, '2026-07-20'), entry(1000, 82, '2026-07-21')]),
      )
      expect(merged.entries.map((e) => e.date).sort()).toEqual(['2026-07-19', '2026-07-21'])
    })

    it('handles two empty devices', () => {
      expect(mergeBodyEntries(side(), side())).toEqual({ entries: [], removedAt: {} })
    })
  })

  it('is stable when merged repeatedly', () => {
    // Reconcile runs on every foreground resume; an unstable merge would flip
    // an entry in and out of existence forever.
    const once = mergeBodyEntries(
      side([entry(3000, 81, '2026-07-19')], { [D]: 2000 }),
      side([entry(1000, 79, '2026-07-19'), entry(1000, 80, D)]),
    )
    const twice = mergeBodyEntries(once, once)
    expect(twice).toEqual(once)
  })

  it('carries the newest timestamp forward so the next merge still resolves', () => {
    // A third device with an even older copy must lose to the carried stamp.
    const merged = mergeBodyEntries(side([], { [D]: 2000 }), side([entry(1000)]))
    const third = mergeBodyEntries(merged, side([entry(1500)]))
    expect(find(third)).toBeUndefined()
    expect(third.removedAt[D]).toBe(2000)
  })
})

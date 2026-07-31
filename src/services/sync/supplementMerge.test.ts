import { describe, expect, it } from 'vitest'
import { mergeSupplementLog, type SupplementLog } from './storeAdapters'

// This merge shipped as a plain union and it was wrong in a way that only shows
// up across two devices: a union can only ADD, so a checkbox cleared on one
// device looked identical to one the other had never touched, and the other put
// it straight back. Unchecking a habit would not stick, and because challenge
// scores are computed from this log, a resurrected tick silently inflated the
// number everyone else on the board could see.
//
// Every test below is a two-device story, because that is the only place the
// bug exists.

const D = '2026-07-31'
const HABIT = 'habit-1'

function side(patch: Partial<SupplementLog> = {}): SupplementLog {
  return { log: {}, manualClears: {}, logAt: {}, ...patch }
}

/** A device where the habit is ticked, last changed at `at`. */
function ticked(at: number): SupplementLog {
  return side({ log: { [D]: { [HABIT]: 1 } }, logAt: { [D]: { [HABIT]: at } } })
}

/** A device where the habit was deliberately cleared at `at`. */
function cleared(at: number): SupplementLog {
  return side({ manualClears: { [D]: { [HABIT]: true } }, logAt: { [D]: { [HABIT]: at } } })
}

describe('mergeSupplementLog', () => {
  it('keeps an unchecked habit unchecked when the other device is stale', () => {
    // The exact regression: laptop still has it ticked from earlier, phone
    // cleared it just now.
    const merged = mergeSupplementLog(cleared(2000), ticked(1000))
    expect(merged.log[D]?.[HABIT]).toBeUndefined()
    expect(merged.manualClears[D]?.[HABIT]).toBe(true)
  })

  it('applies a clear that arrives from the cloud rather than locally', () => {
    const merged = mergeSupplementLog(ticked(1000), cleared(2000))
    expect(merged.log[D]?.[HABIT]).toBeUndefined()
    expect(merged.manualClears[D]?.[HABIT]).toBe(true)
  })

  // The mirror image matters just as much: re-ticking after clearing it
  // elsewhere has to win too, or the fix just reverses the bug.
  it('lets a newer tick beat an older clear', () => {
    const merged = mergeSupplementLog(ticked(3000), cleared(2000))
    expect(merged.log[D]?.[HABIT]).toBe(1)
    expect(merged.manualClears[D]?.[HABIT]).toBeUndefined()
  })

  it('lets a newer tick from the cloud beat an older local clear', () => {
    const merged = mergeSupplementLog(cleared(1000), ticked(2000))
    expect(merged.log[D]?.[HABIT]).toBe(1)
  })

  it('carries the newest timestamp forward so the next merge still resolves', () => {
    const merged = mergeSupplementLog(cleared(2000), ticked(1000))
    expect(merged.logAt[D]?.[HABIT]).toBe(2000)
  })

  it('prefers local on an exact tie, matching unionBy elsewhere', () => {
    const merged = mergeSupplementLog(ticked(1000), cleared(1000))
    expect(merged.log[D]?.[HABIT]).toBe(1)
  })

  it('keeps the dose amount from the winning side', () => {
    const local = side({ log: { [D]: { [HABIT]: 5 } }, logAt: { [D]: { [HABIT]: 2000 } } })
    const cloud = side({ log: { [D]: { [HABIT]: 3 } }, logAt: { [D]: { [HABIT]: 1000 } } })
    expect(mergeSupplementLog(local, cloud).log[D]?.[HABIT]).toBe(5)
    expect(mergeSupplementLog(cloud, local).log[D]?.[HABIT]).toBe(5)
  })

  describe('data written before timestamps existed', () => {
    // The upgrade must not throw away history. With no stamp on either side
    // there is no way to know which is newer, so fall back to the old union.
    it('keeps a cloud-only tick', () => {
      const cloud = side({ log: { [D]: { [HABIT]: 1 } } })
      expect(mergeSupplementLog(side(), cloud).log[D]?.[HABIT]).toBe(1)
    })

    it('keeps a local-only tick', () => {
      const local = side({ log: { [D]: { [HABIT]: 1 } } })
      expect(mergeSupplementLog(local, side()).log[D]?.[HABIT]).toBe(1)
    })

    it('prefers the local amount when both sides have one', () => {
      const local = side({ log: { [D]: { [HABIT]: 5 } } })
      const cloud = side({ log: { [D]: { [HABIT]: 3 } } })
      expect(mergeSupplementLog(local, cloud).log[D]?.[HABIT]).toBe(5)
    })

    it('adds no timestamp it cannot justify', () => {
      const cloud = side({ log: { [D]: { [HABIT]: 1 } } })
      expect(mergeSupplementLog(side(), cloud).logAt[D]?.[HABIT]).toBeUndefined()
    })

    // Once one device upgrades, its stamp is real information and should win —
    // this is what lets an untick finally propagate after the update ships.
    it('lets a stamped clear beat unstamped legacy data', () => {
      const legacy = side({ log: { [D]: { [HABIT]: 1 } } })
      expect(mergeSupplementLog(cleared(5000), legacy).log[D]?.[HABIT]).toBeUndefined()
      expect(mergeSupplementLog(legacy, cleared(5000)).log[D]?.[HABIT]).toBeUndefined()
    })
  })

  describe('leaves unrelated entries alone', () => {
    it('keeps habits each device ticked independently on the same day', () => {
      const local = side({ log: { [D]: { a: 1 } }, logAt: { [D]: { a: 1000 } } })
      const cloud = side({ log: { [D]: { b: 1 } }, logAt: { [D]: { b: 1000 } } })
      const merged = mergeSupplementLog(local, cloud)
      expect(merged.log[D]).toEqual({ a: 1, b: 1 })
    })

    it('keeps different days from each device', () => {
      const local = side({ log: { '2026-07-30': { a: 1 } }, logAt: { '2026-07-30': { a: 1 } } })
      const cloud = side({ log: { '2026-07-31': { a: 1 } }, logAt: { '2026-07-31': { a: 1 } } })
      const merged = mergeSupplementLog(local, cloud)
      expect(Object.keys(merged.log).sort()).toEqual(['2026-07-30', '2026-07-31'])
    })

    it('does not invent empty days for a cleared habit', () => {
      const merged = mergeSupplementLog(cleared(2000), ticked(1000))
      expect(merged.log[D]).toBeUndefined()
    })

    it('handles two empty devices', () => {
      expect(mergeSupplementLog(side(), side())).toEqual({ log: {}, manualClears: {}, logAt: {} })
    })
  })

  it('propagates a habit deleted on one device', () => {
    // removeItem strips the habit's doses and stamps each one, so the deletion
    // travels instead of being unioned back from the other device.
    const afterDelete = side({ logAt: { [D]: { [HABIT]: 9000 } } })
    const stale = ticked(1000)
    expect(mergeSupplementLog(afterDelete, stale).log[D]?.[HABIT]).toBeUndefined()
    expect(mergeSupplementLog(stale, afterDelete).log[D]?.[HABIT]).toBeUndefined()
  })

  it('is stable when merged repeatedly', () => {
    // Reconcile runs on every foreground resume; an unstable merge would flip
    // a checkbox back and forth forever.
    const once = mergeSupplementLog(cleared(2000), ticked(1000))
    const twice = mergeSupplementLog(once, once)
    expect(twice).toEqual(once)
  })
})

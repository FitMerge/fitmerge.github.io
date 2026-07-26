import { describe, expect, it } from 'vitest'
import { WATER_UNITS, snapWaterMl, type WaterUnit } from './units'

const UNITS: WaterUnit[] = ['oz', 'cup', 'L']
const MAX_ADD_ML = 1000

/** What the UI prints for an amount, in the given unit. */
function label(ml: number, unit: WaterUnit): string {
  const u = WATER_UNITS[unit]
  return u.fromMl(ml).toFixed(u.decimals)
}

describe('snapWaterMl', () => {
  // The bug this guards against: the glass read "0.3 L" while logging 250 ml, so
  // four taps claimed 1.2 L and stored 1.0. A snapped amount must always convert
  // back to exactly the number shown next to it.
  it.each(UNITS)('a snapped amount matches its own label (%s)', (unit) => {
    const u = WATER_UNITS[unit]
    for (let raw = 0; raw <= MAX_ADD_ML; raw += 37) {
      const snapped = snapWaterMl(raw, unit, MAX_ADD_ML)
      const shown = Number(label(snapped, unit))
      expect(u.toMl(shown)).toBeCloseTo(snapped, 6)
    }
  })

  it.each(UNITS)('never exceeds the maximum (%s)', (unit) => {
    expect(snapWaterMl(MAX_ADD_ML * 2, unit, MAX_ADD_ML)).toBeLessThanOrEqual(MAX_ADD_ML)
  })

  it.each(UNITS)('never goes negative (%s)', (unit) => {
    expect(snapWaterMl(-500, unit, MAX_ADD_ML)).toBe(0)
  })

  it('lands on the unit grid at the top of the range', () => {
    // 1000 ml is 33.81 oz. Clamping in ml used to leave it there while the label
    // rounded to "34" — snapping must fall back to a whole 33 oz instead.
    const snapped = snapWaterMl(MAX_ADD_ML, 'oz', MAX_ADD_ML)
    expect(label(snapped, 'oz')).toBe('33')
  })

  it('keeps the default pour honest in every unit', () => {
    // A glass (250 ml) is exactly 1 cup, and must not drift when shown as oz or L.
    expect(label(snapWaterMl(250, 'cup', MAX_ADD_ML), 'cup')).toBe('1.0')
    for (const unit of UNITS) {
      const snapped = snapWaterMl(250, unit, MAX_ADD_ML)
      const u = WATER_UNITS[unit]
      expect(u.toMl(Number(label(snapped, unit)))).toBeCloseTo(snapped, 6)
    }
  })

  it('is stable — snapping an already-snapped value changes nothing', () => {
    for (const unit of UNITS) {
      const once = snapWaterMl(437, unit, MAX_ADD_ML)
      expect(snapWaterMl(once, unit, MAX_ADD_ML)).toBeCloseTo(once, 6)
    }
  })
})

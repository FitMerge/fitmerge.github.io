import { describe, expect, it } from 'vitest'
import { parseFoodItems } from './index'
import { VisionError } from '../vision/types'

// These numbers go straight into the food diary, so the guard around a model's
// output matters more than the prompt does — anything malformed, negative or
// absurd has to be rejected or clamped before it can reach the store.
describe('parseFoodItems', () => {
  const ok = {
    items: [
      { name: 'Chicken burrito bowl', servingText: '1 bowl', calories: 720, protein: 46, carbs: 78, fat: 24, confidence: 0.8 },
    ],
  }

  it('keeps a well-formed item intact', () => {
    expect(parseFoodItems(ok)).toEqual([
      { name: 'Chicken burrito bowl', servingText: '1 bowl', calories: 720, protein: 46, carbs: 78, fat: 24, confidence: 0.8 },
    ])
  })

  it('rejects a response that is not an item list', () => {
    expect(() => parseFoodItems({})).toThrow(VisionError)
    expect(() => parseFoodItems(null)).toThrow(VisionError)
    expect(() => parseFoodItems({ items: 'nope' })).toThrow(VisionError)
  })

  it('drops entries with no usable name', () => {
    const items = parseFoodItems({
      items: [{ name: '   ', calories: 100 }, { calories: 200 }, ok.items[0]],
    })
    expect(items).toHaveLength(1)
    expect(items[0].name).toBe('Chicken burrito bowl')
  })

  it('clamps negative macros to zero rather than logging them', () => {
    const [item] = parseFoodItems({
      items: [{ name: 'Weird', calories: -500, protein: -3, carbs: -1, fat: -9, confidence: 0.5 }],
    })
    expect(item).toMatchObject({ calories: 0, protein: 0, carbs: 0, fat: 0 })
  })

  it('caps absurd values so one bad estimate cannot wreck a day', () => {
    const [item] = parseFoodItems({
      items: [{ name: 'Runaway', calories: 999_999, protein: 50_000, confidence: 1 }],
    })
    expect(item.calories).toBe(10_000)
    expect(item.protein).toBe(1_000)
  })

  it('coerces numeric strings and rounds', () => {
    const [item] = parseFoodItems({
      items: [{ name: 'Stringy', calories: '412.6', protein: '30.2', confidence: 0.9 }],
    })
    expect(item.calories).toBe(413)
    expect(item.protein).toBe(30)
  })

  it('defaults missing macros and serving text instead of writing NaN', () => {
    const [item] = parseFoodItems({ items: [{ name: 'Sparse' }] })
    expect(item).toMatchObject({ servingText: '1 serving', calories: 0, protein: 0, carbs: 0, fat: 0 })
    expect(Number.isNaN(item.confidence)).toBe(false)
  })

  it('keeps confidence within 0..1', () => {
    const [high] = parseFoodItems({ items: [{ name: 'A', confidence: 42 }] })
    const [low] = parseFoodItems({ items: [{ name: 'B', confidence: -1 }] })
    expect(high.confidence).toBe(1)
    expect(low.confidence).toBe(0)
  })

  it('returns an empty list when the model found no food', () => {
    expect(parseFoodItems({ items: [] })).toEqual([])
  })
})

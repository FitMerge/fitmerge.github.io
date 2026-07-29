import { describe, expect, it } from 'vitest'
import { parseFoodItems } from './index'
import { VisionError } from '../vision/types'
import { MAX_ALTERNATIVES } from '../vision/alternatives'

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
      {
        name: 'Chicken burrito bowl',
        servingText: '1 bowl',
        calories: 720,
        protein: 46,
        carbs: 78,
        fat: 24,
        confidence: 0.8,
        // Always present, so the swap UI never has to null-check.
        alternatives: [],
      },
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

describe('alternatives', () => {
  const withAlts = (alternatives: unknown) => ({
    items: [{ name: 'Olive oil', servingText: '1 tbsp', calories: 119, protein: 0, carbs: 0, fat: 14, confidence: 0.6, alternatives }],
  })

  it('keeps the runners-up in the order given', () => {
    const [item] = parseFoodItems(
      withAlts([
        { name: 'Butter', servingText: '1 tbsp', calories: 102, protein: 0, carbs: 0, fat: 12 },
        { name: 'Ghee', servingText: '1 tbsp', calories: 112, protein: 0, carbs: 0, fat: 13 },
      ]),
    )
    expect(item.alternatives?.map((a) => a.name)).toEqual(['Butter', 'Ghee'])
  })

  it('drops an alternative that just repeats the headline', () => {
    // The model likes to list its own pick first; offering a swap to what you
    // already have reads as a bug.
    const [item] = parseFoodItems(
      withAlts([
        { name: 'olive oil', servingText: '1 tbsp', calories: 119, protein: 0, carbs: 0, fat: 14 },
        { name: 'Butter', servingText: '1 tbsp', calories: 102, protein: 0, carbs: 0, fat: 12 },
      ]),
    )
    expect(item.alternatives?.map((a) => a.name)).toEqual(['Butter'])
  })

  it('deduplicates repeats within the list', () => {
    const [item] = parseFoodItems(
      withAlts([
        { name: 'Butter', servingText: '1 tbsp', calories: 102, protein: 0, carbs: 0, fat: 12 },
        { name: 'BUTTER', servingText: '1 tbsp', calories: 102, protein: 0, carbs: 0, fat: 12 },
      ]),
    )
    expect(item.alternatives).toHaveLength(1)
  })

  it('caps the list so the swap panel stays scannable', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      name: `Alt ${i}`, servingText: '1 tbsp', calories: 100, protein: 0, carbs: 0, fat: 10,
    }))
    expect(parseFoodItems(withAlts(many))[0].alternatives).toHaveLength(MAX_ALTERNATIVES)
  })

  it('degrades to no swaps rather than breaking the item', () => {
    for (const junk of [undefined, null, 'nope', 42, [{ nope: true }, null, 'x']]) {
      const [item] = parseFoodItems(withAlts(junk))
      expect(item.name, String(junk)).toBe('Olive oil')
      expect(item.alternatives, String(junk)).toEqual([])
    }
  })

  it("clamps an alternative's macros like the headline item", () => {
    const [item] = parseFoodItems(
      withAlts([{ name: 'Bad', servingText: '', calories: -5, protein: 99999, carbs: 0, fat: 0 }]),
    )
    expect(item.alternatives?.[0]).toEqual({
      name: 'Bad', servingText: '1 serving', calories: 0, protein: 1000, carbs: 0, fat: 0,
    })
  })
})

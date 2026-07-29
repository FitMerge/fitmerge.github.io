import { describe, expect, it } from 'vitest'
import {
  compatibleUnits,
  conversionFactor,
  defaultQtyFor,
  parseServing,
  scaleMacros,
  servingLabel,
  stepFor,
} from './portion'

describe('parseServing', () => {
  it('reads the plain case the model produces most often', () => {
    expect(parseServing('1 tbsp')).toEqual({ qty: 1, unit: 'tbsp', known: true })
    expect(parseServing('2 cups')).toEqual({ qty: 2, unit: 'cup', known: true })
  })

  it('ignores an approximate gram tail after the comma', () => {
    // "1 cup, ~150g" is one cup. Reading the tail would silently log 150 g.
    expect(parseServing('1 cup, ~150g')).toEqual({ qty: 1, unit: 'cup', known: true })
    expect(parseServing('1 cup (~150g)')).toEqual({ qty: 1, unit: 'cup', known: true })
  })

  it('keeps a measure it does not recognise instead of discarding it', () => {
    // These still scale — they just cannot be converted into anything else.
    expect(parseServing('2 large eggs')).toEqual({ qty: 2, unit: 'large eggs', known: false })
    expect(parseServing('1 slice')).toEqual({ qty: 1, unit: 'slice', known: false })
  })

  it('handles fractions, both written and typeset', () => {
    expect(parseServing('1/2 cup')).toEqual({ qty: 0.5, unit: 'cup', known: true })
    expect(parseServing('½ cup')).toEqual({ qty: 0.5, unit: 'cup', known: true })
  })

  it('defaults to one when no number is given', () => {
    expect(parseServing('handful')).toEqual({ qty: 1, unit: 'handful', known: false })
  })

  it('accepts the spellings a language model actually uses', () => {
    for (const t of ['1 tablespoon', '1 Tablespoons', '1 TBSP']) {
      expect(parseServing(t).unit, t).toBe('tbsp')
    }
    expect(parseServing('8 fl oz').unit).toBe('floz')
    expect(parseServing('100 grams').unit).toBe('g')
  })

  it('never returns a zero or negative quantity to divide by', () => {
    expect(parseServing('0 cups').qty).toBe(1)
    expect(parseServing('').qty).toBe(1)
  })
})

describe('conversionFactor', () => {
  it('scales within the same unit', () => {
    expect(conversionFactor(parseServing('1 tbsp'), 3, 'tbsp')).toBe(3)
  })

  it('converts across a family', () => {
    // 1 tbsp = 15 g-equivalent, 1 cup = 240 → one cup is sixteen tablespoons.
    expect(conversionFactor(parseServing('1 tbsp'), 1, 'cup')).toBeCloseTo(16, 6)
    expect(conversionFactor(parseServing('100 g'), 1, 'oz')).toBeCloseTo(0.283495, 6)
  })

  it('refuses a conversion it cannot honestly make', () => {
    // "2 slices" to grams has no answer without knowing the food.
    expect(conversionFactor(parseServing('2 slices'), 100, 'g')).toBeNull()
  })

  it('handles a fractional starting portion', () => {
    expect(conversionFactor(parseServing('1/2 cup'), 1, 'cup')).toBe(2)
  })
})

describe('compatibleUnits', () => {
  it('offers only same-family swaps', () => {
    expect(compatibleUnits('tbsp')).toContain('cup')
    expect(compatibleUnits('tbsp')).not.toContain('g')
    expect(compatibleUnits('g')).toContain('oz')
    expect(compatibleUnits('g')).not.toContain('cup')
  })

  it('offers nothing for a measure it does not understand', () => {
    expect(compatibleUnits('large eggs')).toEqual([])
  })
})

describe('scaleMacros', () => {
  it('scales every macro by the same factor', () => {
    const base = { calories: 100, protein: 10, carbs: 20, fat: 5 }
    expect(scaleMacros(base, 3)).toEqual({ calories: 300, protein: 30, carbs: 60, fat: 15 })
  })
})

describe('servingLabel', () => {
  it('reads naturally for both known and unknown units', () => {
    expect(servingLabel(3, 'tbsp')).toBe('3 tbsp')
    expect(servingLabel(2, 'large eggs')).toBe('2 large eggs')
    expect(servingLabel(0.5, 'cup')).toBe('0.5 cups')
  })

  it('does not print floating-point noise', () => {
    expect(servingLabel(1 / 3, 'cup')).toBe('0.33 cups')
  })

  it('pluralises a word unit but never an abbreviation', () => {
    expect(servingLabel(2, 'cup')).toBe('2 cups')
    expect(servingLabel(1, 'cup')).toBe('1 cup')
    expect(servingLabel(3, 'tbsp')).toBe('3 tbsp')
    expect(servingLabel(100, 'g')).toBe('100 g')
  })
})

describe('defaultQtyFor', () => {
  it('restarts the amount when the unit changes', () => {
    // Carrying "3" from tablespoons into cups silently produced three cups of
    // olive oil — right arithmetic, 5,712 kcal, wrong meaning.
    expect(defaultQtyFor('cup')).toBe(1)
    expect(defaultQtyFor('tbsp')).toBe(1)
    expect(defaultQtyFor('g')).toBe(100)
    expect(defaultQtyFor('ml')).toBe(100)
  })
})

describe('stepFor', () => {
  it('steps grams in tens and countables in ones', () => {
    expect(stepFor('g')).toBe(10)
    expect(stepFor('tbsp')).toBe(1)
    expect(stepFor('large eggs')).toBe(1)
  })
})

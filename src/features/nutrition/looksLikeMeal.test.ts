import { describe, expect, it } from 'vitest'
import { looksLikeMeal } from './AddSearchTab'

// This decides whether the "log this as a meal" offer appears above the search
// results. A false negative is the costly one — it leaves someone scrolling rows
// that can never match a described plate — so the bar is deliberately low.
describe('looksLikeMeal', () => {
  it.each([
    'chicken burrito bowl with rice, black beans and guac',
    'two scrambled eggs, toast with butter',
    '8oz sirloin and a baked potato',
    'oatmeal with blueberries',
    'large latte',
    'half a bagel with cream cheese',
    'grilled chicken salad ranch dressing',
  ])('offers a breakdown for %j', (q) => {
    expect(looksLikeMeal(q)).toBe(true)
  })

  it.each(['chicken', 'egg', 'milk', 'greek yogurt', 'olive oil', 'banana'])(
    'leaves a plain food search alone (%j)',
    (q) => {
      expect(looksLikeMeal(q)).toBe(false)
    },
  )

  it('ignores whitespace and case', () => {
    expect(looksLikeMeal('   Rice AND Beans   ')).toBe(true)
    expect(looksLikeMeal('   ')).toBe(false)
  })

  it('does not fire on a short fragment mid-typing', () => {
    // "chi", "chick" — the offer appearing and vanishing while typing reads as a glitch.
    expect(looksLikeMeal('chi')).toBe(false)
    expect(looksLikeMeal('chick')).toBe(false)
  })
})

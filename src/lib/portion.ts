// Portion arithmetic for AI-estimated foods.
//
// The AI hands back one number set for one assumed portion — "1 tbsp, 119 kcal".
// Changing that to 3 tbsp used to mean recomputing four macros by hand, which is
// exactly the point where logging a meal stops being quick. Everything here
// exists to turn "the portion is wrong" into one tap.
//
// Scaling is linear, which is right for the same substance in a different amount
// (three tablespoons is three times one tablespoon). It is NOT right across
// different foods, so nothing here ever converts between two items' numbers.

import type { Macros } from '../types'

/** Grams per one of each measure. Weight units are exact; volume units are the
 * standard approximations used for quick estimating — real grams-per-cup varies
 * by food, so these are for getting close, not for a lab. */
export const UNIT_GRAMS: Record<string, number> = {
  g: 1,
  kg: 1000,
  mg: 0.001,
  oz: 28.3495,
  lb: 453.592,
  cup: 240,
  tbsp: 15,
  tsp: 5,
  floz: 30,
  ml: 1,
  l: 1000,
}

/** Spellings the model actually produces, mapped to a canonical unit key. */
const UNIT_ALIASES: Record<string, string> = {
  g: 'g', gram: 'g', grams: 'g',
  kg: 'kg', kilogram: 'kg', kilograms: 'kg',
  mg: 'mg',
  oz: 'oz', ounce: 'oz', ounces: 'oz',
  lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb',
  cup: 'cup', cups: 'cup',
  tbsp: 'tbsp', tbsps: 'tbsp', tablespoon: 'tbsp', tablespoons: 'tbsp',
  tsp: 'tsp', tsps: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp',
  floz: 'floz', 'fl oz': 'floz', 'fluid ounce': 'floz', 'fluid ounces': 'floz',
  ml: 'ml', milliliter: 'ml', millilitre: 'ml', milliliters: 'ml', millilitres: 'ml',
  l: 'l', liter: 'l', litre: 'l', liters: 'l', litres: 'l',
}

export const UNIT_LABEL: Record<string, string> = {
  g: 'g', kg: 'kg', mg: 'mg', oz: 'oz', lb: 'lb',
  cup: 'cup', tbsp: 'tbsp', tsp: 'tsp', floz: 'fl oz', ml: 'ml', l: 'L',
}

/** Units offered as swaps, grouped so we never offer grams as a swap for "eggs". */
const WEIGHT_UNITS = ['g', 'oz', 'lb']
const VOLUME_UNITS = ['tsp', 'tbsp', 'cup', 'floz', 'ml']

export type ParsedServing = {
  /** How many. Defaults to 1 when the text names no number. */
  qty: number
  /**
   * The measure, canonicalised when we recognise it ('tbsp'), or the raw noun
   * when we do not ('large eggs', 'slice'). An unrecognised unit still scales
   * fine — it just cannot be converted into anything else.
   */
  unit: string
  /** True when `unit` is a measure we can convert (and therefore offer swaps for). */
  known: boolean
}

const VULGAR: Record<string, number> = {
  '½': 0.5, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 0.25, '¾': 0.75, '⅛': 0.125,
}

/**
 * Pull a quantity and a measure out of the model's serving text.
 *
 * Deliberately forgiving: the input is free text from a language model, so this
 * takes what it recognises and leaves the rest alone rather than rejecting.
 * "1 cup, ~150g" -> 1 cup. "2 large eggs" -> 2 "large eggs". "a handful" -> 1
 * "handful".
 */
export function parseServing(servingText: string): ParsedServing {
  const text = servingText.trim().toLowerCase()
  if (!text) return { qty: 1, unit: 'serving', known: false }

  // Everything before the first comma: "1 cup, ~150g" is one cup, not 150 grams.
  const head = text.split(',')[0].trim()

  // Leading quantity: "2", "1.5", "1/2", "½", or nothing.
  let qty = 1
  let rest = head
  const num = head.match(/^(\d+\s*\/\s*\d+|\d*\.?\d+)\s*(.*)$/)
  const vulgar = head.match(/^([½⅓⅔¼¾⅛])\s*(.*)$/)
  if (num) {
    const raw = num[1].replace(/\s+/g, '')
    qty = raw.includes('/')
      ? Number(raw.split('/')[0]) / Number(raw.split('/')[1])
      : Number(raw)
    rest = num[2].trim()
  } else if (vulgar) {
    qty = VULGAR[vulgar[1]]
    rest = vulgar[2].trim()
  }
  if (!Number.isFinite(qty) || qty <= 0) qty = 1

  // Drop a parenthetical or approximate tail: "cup (~150g)" -> "cup".
  rest = rest.replace(/\(.*$/, '').replace(/~.*$/, '').trim()
  if (!rest) return { qty, unit: 'serving', known: false }

  const canonical = UNIT_ALIASES[rest] ?? UNIT_ALIASES[rest.replace(/\s+/g, '')]
  if (canonical) return { qty, unit: canonical, known: true }

  // Unrecognised measure — keep the words, singularised only when a count made
  // it plural ("2 large eggs" reads better as "large egg" on a stepper).
  return { qty, unit: rest, known: false }
}

/** Units it makes sense to offer alongside `unit` — same family only. */
export function compatibleUnits(unit: string): string[] {
  if (WEIGHT_UNITS.includes(unit)) return WEIGHT_UNITS
  if (VOLUME_UNITS.includes(unit)) return VOLUME_UNITS
  return []
}

/**
 * The multiplier to get from `from` (qty + unit) to `to`. Returns null when the
 * two cannot be compared — which is the honest answer for "2 slices" to "grams",
 * and the reason unit swaps are only offered within a family.
 */
export function conversionFactor(from: ParsedServing, toQty: number, toUnit: string): number | null {
  if (from.qty <= 0) return null
  if (from.unit === toUnit) return toQty / from.qty
  const a = UNIT_GRAMS[from.unit]
  const b = UNIT_GRAMS[toUnit]
  if (a === undefined || b === undefined) return null
  const fromGrams = from.qty * a
  if (fromGrams <= 0) return null
  return (toQty * b) / fromGrams
}

export function scaleMacros(base: Macros, factor: number): Macros {
  return {
    calories: base.calories * factor,
    protein: base.protein * factor,
    carbs: base.carbs * factor,
    fat: base.fat * factor,
  }
}

/** Units whose label is a word and so needs a plural. Abbreviations (g, tbsp,
 * fl oz) never take one. */
const PLURALISES = new Set(['cup'])

/** How the portion should read once logged — "3 tbsp", "2 cups", "2 large eggs". */
export function servingLabel(qty: number, unit: string): string {
  const n = Math.round(qty * 100) / 100
  const label = UNIT_LABEL[unit] ?? unit
  return `${n} ${PLURALISES.has(unit) && n !== 1 ? `${label}s` : label}`
}

/**
 * The amount to show when the unit is switched.
 *
 * Carrying the old number across is actively dangerous: going from "3 tbsp" to
 * cups kept the 3 and quietly produced three CUPS of olive oil — arithmetically
 * correct, 5,712 kcal, and not what anyone meant. A unit change restates the
 * portion, so it restarts from a sane amount for that unit.
 */
export function defaultQtyFor(unit: string): number {
  if (unit === 'g' || unit === 'ml') return 100
  if (unit === 'mg') return 500
  return 1
}

/** Step size that feels right for a stepper on this unit. */
export function stepFor(unit: string): number {
  if (unit === 'g' || unit === 'ml') return 10
  if (unit === 'mg') return 100
  if (unit === 'kg' || unit === 'l' || unit === 'lb') return 0.1
  return 1
}

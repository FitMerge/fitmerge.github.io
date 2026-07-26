// Shared unit-conversion helpers for FitMerge. Canonical storage units are always
// metric (kg, cm, ml) — these helpers only convert for display/input purposes.
import type { Units } from '../types'

// Weight
export const KG_PER_LB = 0.45359237

export function kgToLb(kg: number): number {
  return kg / KG_PER_LB
}

export function lbToKg(lb: number): number {
  return lb * KG_PER_LB
}

export function convertWeight(kg: number, units: Units): number {
  return units === 'imperial' ? kgToLb(kg) : kg
}

export function weightUnit(units: Units): string {
  return units === 'imperial' ? 'lb' : 'kg'
}

// Height
const CM_PER_IN = 2.54

export function cmToInch(cm: number): number {
  return cm / CM_PER_IN
}

export function inchToCm(inch: number): number {
  return inch * CM_PER_IN
}

// Volume
const ML_PER_FLOZ = 29.5735

export function mlToFloz(ml: number): number {
  return ml / ML_PER_FLOZ
}

export function flozToMl(floz: number): number {
  return floz * ML_PER_FLOZ
}

export function waterUnit(units: Units): 'oz' | 'ml' {
  return units === 'imperial' ? 'oz' : 'ml'
}

// A "cup" here is a 250 ml glass, so the default 2 L goal is exactly 8 cups —
// matching the quick-fill glasses on the water card.
export const ML_PER_CUP = 250

export function mlToCups(ml: number): number {
  return ml / ML_PER_CUP
}

export function cupsToMl(cups: number): number {
  return cups * ML_PER_CUP
}

export function mlToL(ml: number): number {
  return ml / 1000
}

export function lToMl(l: number): number {
  return l * 1000
}

/** The units the water logger can dial in. Storage stays canonical ml. */
export type WaterUnit = 'oz' | 'cup' | 'L'

// Per-unit display config: how to convert to/from ml, and the slider step +
// decimal precision + suffix that make each scale read naturally.
export const WATER_UNITS: Record<
  WaterUnit,
  { label: string; fromMl: (ml: number) => number; toMl: (v: number) => number; step: number; decimals: number }
> = {
  oz: { label: 'oz', fromMl: mlToFloz, toMl: flozToMl, step: 1, decimals: 0 },
  cup: { label: 'cups', fromMl: mlToCups, toMl: cupsToMl, step: 0.5, decimals: 1 },
  L: { label: 'L', fromMl: mlToL, toMl: lToMl, step: 0.1, decimals: 1 },
}

export function defaultWaterUnit(units: Units): WaterUnit {
  return units === 'imperial' ? 'oz' : 'L'
}

/**
 * Snap an ml amount onto the unit's step grid, clamped to [0, maxMl].
 *
 * Rounding happens in DISPLAY units and the ceiling is rounded down onto the same
 * grid, so the snapped value always converts back to exactly what the UI prints.
 * Clamping in ml instead would land between steps at the top of the range — the
 * glass would read "34 oz" while holding 33.8. Shared by the slider and everything
 * that seeds it, so a label can never disagree with the amount it logs.
 */
export function snapWaterMl(ml: number, unit: WaterUnit, maxMl: number): number {
  const u = WATER_UNITS[unit]
  const EPSILON = 1e-9 // keeps floating point from shaving a whole step off the top
  const maxOnGrid = Math.floor((u.fromMl(maxMl) + EPSILON) / u.step) * u.step
  const stepped = Math.round(u.fromMl(ml) / u.step) * u.step
  return u.toMl(Math.min(maxOnGrid, Math.max(0, stepped)))
}

// US gallon, for people who set their goal that way (e.g. the 75 Hard challenge).
export const ML_PER_GALLON = 3785.41

export function mlToGallon(ml: number): number {
  return ml / ML_PER_GALLON
}

export function gallonToMl(gal: number): number {
  return gal * ML_PER_GALLON
}

/** Units a goal can be entered in — the logging units plus gallons. */
export type GoalWaterUnit = WaterUnit | 'gal'

export const GOAL_WATER_UNITS: Record<
  GoalWaterUnit,
  { label: string; fromMl: (ml: number) => number; toMl: (v: number) => number; step: number; decimals: number }
> = {
  ...WATER_UNITS,
  gal: { label: 'gal', fromMl: mlToGallon, toMl: gallonToMl, step: 0.25, decimals: 2 },
}

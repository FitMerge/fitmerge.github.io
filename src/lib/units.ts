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

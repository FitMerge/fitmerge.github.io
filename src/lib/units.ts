// Shared unit-conversion helpers for Rung. Canonical storage units are always
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

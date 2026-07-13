// Body-measurement catalog. Values are stored in centimetres and converted to
// inches for imperial display. Open-ended: an entry may include any subset.

export type MeasurementDef = {
  id: string
  label: string
  /** Display order in the measurements list. */
  order: number
}

export const MEASUREMENTS: MeasurementDef[] = [
  { id: 'neck', label: 'Neck', order: 1 },
  { id: 'shoulders', label: 'Shoulders', order: 2 },
  { id: 'chest', label: 'Chest', order: 3 },
  { id: 'leftArm', label: 'Left arm', order: 4 },
  { id: 'rightArm', label: 'Right arm', order: 5 },
  { id: 'forearm', label: 'Forearm', order: 6 },
  { id: 'waist', label: 'Waist', order: 7 },
  { id: 'hips', label: 'Hips', order: 8 },
  { id: 'leftThigh', label: 'Left thigh', order: 9 },
  { id: 'rightThigh', label: 'Right thigh', order: 10 },
  { id: 'calf', label: 'Calf', order: 11 },
]

const BY_ID = new Map(MEASUREMENTS.map((m) => [m.id, m]))

export function measurementLabel(id: string): string {
  return BY_ID.get(id)?.label ?? id
}

const CM_PER_INCH = 2.54

/** cm → display value in the given unit system (imperial = inches). */
export function fromCm(cm: number, imperial: boolean): number {
  return imperial ? cm / CM_PER_INCH : cm
}

/** display value (imperial = inches) → cm for storage. */
export function toCm(value: number, imperial: boolean): number {
  return imperial ? value * CM_PER_INCH : value
}

export function lengthUnitLabel(imperial: boolean): string {
  return imperial ? 'in' : 'cm'
}

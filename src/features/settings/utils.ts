const CM_PER_IN = 2.54

export function cmToIn(cm: number): number {
  return cm / CM_PER_IN
}

export function inToCm(inches: number): number {
  return inches * CM_PER_IN
}

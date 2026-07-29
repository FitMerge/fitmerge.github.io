// Types for the photo -> macro analysis vision providers.

/**
 * A runner-up identification for an item.
 *
 * The model always had a ranked list and only ever showed us its top pick, so a
 * near-miss ("olive oil" when you meant "butter") could only be fixed by
 * retyping the name and all four macros. Carrying the runners-up costs one
 * larger response and turns that into a tap.
 */
export type FoodAlternative = {
  name: string
  servingText: string
  calories: number
  protein: number
  carbs: number
  fat: number
}

export type FoodAnalysisItem = {
  name: string
  servingText: string
  calories: number
  protein: number
  carbs: number
  fat: number
  /** 0..1 */
  confidence: number
  /** Other plausible readings, best first. Absent when the model offered none. */
  alternatives?: FoodAlternative[]
}

export type FoodAnalysis = {
  items: FoodAnalysisItem[]
  provider: 'mock' | 'gemini'
}

export class VisionError extends Error {
  cause?: unknown

  constructor(message: string, cause?: unknown) {
    super(message)
    this.name = 'VisionError'
    this.cause = cause
  }
}

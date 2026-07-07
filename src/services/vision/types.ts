// Types for the photo -> macro analysis vision providers.

export type FoodAnalysisItem = {
  name: string
  servingText: string
  calories: number
  protein: number
  carbs: number
  fat: number
  /** 0..1 */
  confidence: number
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

import { analyzeMock } from './mockProvider'
import { analyzeGemini } from './geminiProvider'
import type { FoodAnalysis } from './types'

export type { FoodAnalysis, FoodAnalysisItem } from './types'
export { VisionError } from './types'

export async function analyzeFoodPhoto(
  imageDataUrl: string,
  apiKey: string | undefined,
): Promise<FoodAnalysis> {
  const trimmedKey = apiKey?.trim()
  if (trimmedKey) {
    return analyzeGemini(imageDataUrl, trimmedKey)
  }
  return analyzeMock(imageDataUrl)
}

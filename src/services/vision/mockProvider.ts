// Deterministic mock vision provider — used when no Gemini API key is configured.
// Simulates network latency and returns a plausible, deterministic meal breakdown
// so demo mode feels realistic without any external calls.

import type { FoodAnalysis, FoodAnalysisItem } from './types'

const MOCK_LATENCY_MS = 1200

type Variant = FoodAnalysisItem[]

const VARIANTS: Variant[] = [
  [
    { name: 'Grilled chicken breast', servingText: '1 breast, ~150g', calories: 248, protein: 46, carbs: 0, fat: 5.4, confidence: 0.86 },
    { name: 'White rice', servingText: '1 cup, ~160g', calories: 205, protein: 4.3, carbs: 45, fat: 0.4, confidence: 0.78 },
    { name: 'Steamed broccoli', servingText: '1 cup, ~90g', calories: 31, protein: 2.5, carbs: 6, fat: 0.3, confidence: 0.72 },
  ],
  [
    { name: 'Baked salmon', servingText: '1 fillet, ~140g', calories: 291, protein: 39, carbs: 0, fat: 14, confidence: 0.81 },
    { name: 'Mixed green salad', servingText: '2 cups, ~120g', calories: 45, protein: 2, carbs: 7, fat: 1.5, confidence: 0.64 },
  ],
  [
    { name: 'Oatmeal', servingText: '1 bowl, ~240g', calories: 158, protein: 6, carbs: 27, fat: 3.2, confidence: 0.75 },
    { name: 'Banana', servingText: '1 medium', calories: 105, protein: 1.3, carbs: 27, fat: 0.4, confidence: 0.89 },
  ],
  [
    { name: 'Cheeseburger', servingText: '1 burger, ~220g', calories: 535, protein: 27, carbs: 36, fat: 31, confidence: 0.83 },
    { name: 'French fries', servingText: '1 medium serving, ~120g', calories: 365, protein: 4, carbs: 48, fat: 17, confidence: 0.79 },
  ],
  [
    { name: 'Scrambled eggs', servingText: '2 eggs', calories: 182, protein: 12.6, carbs: 1.6, fat: 13.6, confidence: 0.85 },
    { name: 'Whole wheat toast', servingText: '2 slices', calories: 138, protein: 6, carbs: 24, fat: 2.2, confidence: 0.74 },
    { name: 'Avocado', servingText: '1/2 avocado, ~70g', calories: 114, protein: 1.4, carbs: 6, fat: 10.5, confidence: 0.68 },
  ],
]

function hashLength(len: number): number {
  // Simple deterministic hash so the same photo (same data-url length) yields the same variant.
  let h = 0
  for (let i = 0; i < 32; i++) {
    h = (h * 31 + ((len >> (i % 24)) & 0xff) + i) | 0
  }
  return Math.abs(h)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function analyzeMock(imageDataUrl: string): Promise<FoodAnalysis> {
  await sleep(MOCK_LATENCY_MS)

  const idx = hashLength(imageDataUrl.length) % VARIANTS.length
  const variant = VARIANTS[idx]

  return {
    items: variant.map((item) => ({ ...item })),
    provider: 'mock',
  }
}

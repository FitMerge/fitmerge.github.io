# FitMerge

One app for nutrition **and** training — the macro-tracking core of MyFitnessPal merged
with the customizable workout plans of a personal training coach, built as a mobile-first
installable PWA.

## Features

### Nutrition
- **Photo → macros**: snap or upload a meal photo and get identified foods with estimated
  calories, protein, carbs, and fat. Works out of the box in demo mode (sample results);
  add a free [Google Gemini API key](https://aistudio.google.com/apikey) in **Settings**
  for real AI analysis.
- **Food search**: free OpenFoodFacts database (no key needed) with per-100g/per-serving
  scaling, plus a reusable "My foods" list.
- **Manual logging**, meal-grouped daily diary, copy-yesterday, and daily calorie/macro
  goals with progress rings.

### Training
- **Exercise library**: 46 seeded exercises filterable by muscle group and equipment.
- **Routine builder**: custom plans with per-exercise sets/reps/rest and weekday scheduling.
- **Live session logger**: elapsed timer, per-set weight/reps, rest countdown with +15s/skip,
  previous-weight prefill, ad-hoc quick workouts, resumable after reload.

### Progress & more
- Weight trend, calorie history vs goal, macro averages, weekly training volume, and
  top-5 personal records (estimated 1RM).
- TDEE calculator (Mifflin-St Jeor) with one-tap suggested goals.
- Metric/imperial units, JSON data export, full local persistence (no account needed —
  all data stays in your browser).

## Development

```bash
npm install
npm run dev        # dev server at http://localhost:5173
npm run build      # typecheck + production build (PWA)
npm run preview    # serve the production build
```

## Stack

Vite · React 18 · TypeScript (strict) · Tailwind CSS · Zustand (persisted) · Dexie
(IndexedDB photo thumbnails) · Recharts · vite-plugin-pwa.

State lives in four persisted stores (`src/store/`). The photo analyzer
(`src/services/vision/`) is provider-agnostic: a deterministic mock by default, Gemini 2.0
Flash when a key is configured — other providers can be added behind the same interface.

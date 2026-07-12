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

### Health Data Connect
- Import weigh-ins and workouts from an **Apple Health** export, a **Garmin Connect** CSV,
  or a documented **FitMerge JSON** file — all parsed locally in the browser, nothing is
  uploaded anywhere. See [Connect Apple Health & Garmin](#connect-apple-health--garmin) below.

## Connect Apple Health & Garmin

FitMerge's **Settings → Connect health data** card imports weigh-ins and workouts from three
sources. All parsing happens locally in the browser — nothing is uploaded to a server.

### Apple Health

1. Open the **Health** app on your iPhone → tap your profile picture (top right) → **Export
   All Health Data**.
2. AirDrop or otherwise transfer the resulting `export.zip` to the device running FitMerge.
3. In FitMerge, go to **Settings → Connect health data → Import file** and pick the zip (or
   the `export.xml` inside it). Body weight, body fat percentage, and workouts are extracted.

### Garmin Connect (CSV)

1. On [connect.garmin.com](https://connect.garmin.com), open **Reports** and export either a
   **weight** history CSV or an **activities** CSV.
2. In FitMerge, **Settings → Connect health data → Import file** and pick the CSV. FitMerge
   detects which kind of export it is from the header row.

### Garmin Connect (`garmin-sync.py` script)

For a one-shot pull of both weigh-ins and activities into a single file:

```bash
pip install garminconnect
python3 scripts/garmin-sync.py --days 90 --out fitmerge-import.json
```

Credentials come from the `GARMIN_EMAIL` / `GARMIN_PASSWORD` environment variables (or you'll
be prompted). The session token is cached locally so you won't be re-prompted every run. Then
import the resulting `fitmerge-import.json` the same way as any other file.

Run `python3 scripts/garmin-sync.py --self-test` to sanity-check the script offline (no
network or `garminconnect` install needed) — this is what CI runs to validate the script.

### Claude / MCP route

If you'd rather have Claude do the pull: install a community Garmin MCP server in Claude
Desktop (e.g. [Taxuspt/garmin_mcp](https://github.com/Taxuspt/garmin_mcp) or
[eddmann/garmin-connect-mcp](https://github.com/eddmann/garmin-connect-mcp)), then ask Claude
to emit a FitMerge JSON file using the schema below and import the result.

**Example prompt:** *"Using the Garmin MCP server, pull my weigh-ins and activities from the
last 90 days and write them to `fitmerge-import.json` in the FitMerge JSON schema below."*

**FitMerge JSON schema (version 1):**

```json
{
  "version": 1,
  "weights": [
    { "date": "YYYY-MM-DD", "weightKg": 82.4, "bodyFatPct": 21.5 }
  ],
  "sessions": [
    { "name": "Running", "date": "YYYY-MM-DD", "durationMin": 32.5, "kcal": 320 }
  ]
}
```

`bodyFatPct`, `durationMin`, and `kcal` are all optional. Dates are local `YYYY-MM-DD`
strings. Re-importing the same file is safe — weigh-ins replace same-date entries and
previously-imported workouts (matched by date + name) are skipped rather than duplicated.

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

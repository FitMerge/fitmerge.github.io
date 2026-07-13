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
- **Exercise library with demonstrations**: 46 seeded exercises filterable by muscle group and
  equipment. Each opens a detail sheet with a **front/back muscle map** highlighting the primary
  and secondary muscles worked, numbered how-to steps, and your personal best.
- **Routine builder**: custom plans with per-exercise sets/reps/rest, per-exercise notes, and
  weekday scheduling.
- **In-workout management**: reorder, replace, or remove exercises mid-session, add per-exercise
  notes, and a built-in **plate calculator** (what to load on each side of the bar).
- **Training statistics**: lifetime totals (workouts, volume, reps, time), a weekly-frequency
  chart, week-streak, and a **muscle-balance** view of sets per muscle over the last 30 days.
- **Body measurements**: track chest, arms, waist, thighs and more over time, with per-measure
  history charts (alongside body-weight tracking).
- **Hevy-style session logger**: a compact set table showing each set's **previous** performance
  (tap to copy), **warmup / drop set types** (tap the set badge to cycle), and a **🏆 live PR
  flag** when a set beats your best estimated 1RM. Elapsed timer, rest countdown with +15s/skip,
  previous-weight prefill, ad-hoc quick workouts, resumable after reload, and a finish summary
  that celebrates new personal records. Warmup sets are excluded from volume and PR totals.

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

For a one-shot pull of **everything** — weigh-ins, activities, and daily wellness metrics
(steps, sleep + sleep score, resting HR, HRV, stress, Body Battery, VO₂ max, SpO₂, respiration,
floors, moderate/vigorous intensity minutes, per-activity training load, active/total calories) —
into a single file:

```bash
pip install garminconnect
python3 scripts/garmin-sync.py --days 90 --out fitmerge-import.json
```

The daily metrics land in `Progress → Health metrics`. The `metrics` bag is open-ended: any
numeric field the script pulls is imported and displayed, so new Garmin metrics show up with no
code change.

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

**Example prompt:** *"Using the Garmin MCP server, pull my weigh-ins, activities, and daily
health metrics (steps, sleep, resting HR, HRV, stress, Body Battery, VO₂ max, SpO₂) from the
last 90 days and write them to `fitmerge-import.json` in the FitMerge JSON schema below."*

**FitMerge JSON schema (version 1):**

```json
{
  "version": 1,
  "weights": [
    { "date": "YYYY-MM-DD", "weightKg": 82.4, "bodyFatPct": 21.5 }
  ],
  "sessions": [
    { "name": "Running", "date": "YYYY-MM-DD", "durationMin": 32.5, "kcal": 320, "trainingLoad": 88 }
  ],
  "health": [
    { "date": "YYYY-MM-DD", "metrics": {
        "steps": 9241, "restingHr": 53, "sleepMinutes": 432, "sleepScore": 84,
        "stress": 29, "bodyBattery": 81, "hrv": 64, "spo2": 96, "vo2max": 47.5,
        "floors": 12, "intensityMinutes": 45, "moderateIntensityMinutes": 30,
        "vigorousIntensityMinutes": 15, "activeCalories": 620
      } }
  ]
}
```

`weights`, `sessions`, and `health` are all optional (include any subset). The `metrics` object
is an **open-ended bag of numbers** — any key you include is stored and shown on the Health
metrics screen; known keys get nice labels/units, unknown ones display with a derived label.
`bodyFatPct`, `durationMin`, `kcal`, and `trainingLoad` are optional. Dates are local
`YYYY-MM-DD` strings.

### Coaching analytics (Progress tab)

Imported workouts + health metrics power a sports-science dashboard at the top of **Progress**:

- **Form & Fitness** — a Performance Management Chart (CTL fitness / ATL fatigue / TSB form)
  with a 28-day forward projection. Uses Garmin's `trainingLoad` when present, else estimates
  load from activity calories.
- **Injury & illness risk** — the Acute:Chronic Workload Ratio (ACWR) gauge plus recovery flags
  (HRV/resting-HR divergence, sleep deficit, low Body Battery).
- **Recovery — HR vs HRV** and **Intensity distribution** trend charts.
- **Explain this** — sends the current numbers to Gemini (uses the same key as photo analysis)
  for a plain-English coach interpretation.
Re-importing is safe — weigh-ins replace same-date entries, previously-imported workouts
(matched by date + name) are skipped, and health metrics merge per date.

## Sync across devices (Google login)

FitMerge works fully offline with no account — everything is stored locally in the
browser. If you want the same nutrition, workouts, and body data on more than one
device, **Settings → Sync across devices** lets you connect your own free Firebase
project and sign in with Google; this is entirely optional and additive.

One-time setup (a few minutes):

1. Go to the [Firebase console](https://console.firebase.google.com/) and click
   **Add project** (the free Spark plan is enough).
2. In **Build → Authentication**, enable the **Google** sign-in provider.
3. Still in Authentication, under **Settings → Authorized domains**, add
   `skidude3892.github.io`.
4. In **Build → Firestore Database**, click **Create database**, then open the
   **Rules** tab and replace the contents with:

   ```
   match /users/{uid}/{doc=**} {
     allow read, write: if request.auth != null && request.auth.uid == uid;
   }
   ```

5. In **Project settings → General**, scroll to **Your apps**, add a web app, and
   copy the `firebaseConfig` snippet it shows you.
6. Paste that snippet into the Sync card in Settings and tap **Connect Firebase**,
   then **Sign in with Google** on each device you want to sync.

The pasted config values (`apiKey`, `authDomain`, `projectId`, `appId`, ...) are **not
secret** — Firebase web apps ship them in the client bundle by design, and they only
identify your project. Actual access to your data is controlled by the Firestore
security rule above, which restricts every document to the signed-in user that owns it.

Sync merges each store (nutrition, workouts, body, settings) the first time a device
signs in, so existing local data on a second device is combined with the cloud copy
rather than overwritten, then stays live in both directions.

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

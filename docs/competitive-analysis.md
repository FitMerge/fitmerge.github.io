# FitMerge Competitive Analysis & Gap Roadmap

_Last updated: 2026-07-13_

## Intro

FitMerge is a mobile-first fitness PWA that fuses three normally-separate products: nutrition tracking (MyFitnessPal/MacroFactor style), strength logging (Hevy/Strong style), and endurance/health analytics (Garmin + TrainingPeaks style). Its differentiator is that it already owns the hard, coach-grade endurance layer — CTL/ATL/TSB performance-management chart, ACWR injury risk, HR-vs-HRV, intensity distribution, forward projection, plus 1985 days of Garmin daily metrics and 1010 activities with per-activity training load. That analytics moat is ahead of Hevy/Strong.

The gaps are concentrated in three areas the user already flagged: (a) no pre-built training **programs** to pick from, (b) no **cardio progression charts** (pace/distance/duration trends) despite most of the user's data being walk/run/cycle activities, and (c) no explicit **"improvement" tracking** (pace, total volume, e1RM over time). This doc benchmarks six best-in-class apps, tags each signature feature relative to FitMerge's current state, consolidates the gaps, and lays out a prioritized, buildable roadmap.

Legend: **`[HAVE]`** = shipped, **`[PARTIAL]`** = partially present / data exists but not surfaced, **`[GAP]`** = missing.

---

## 1. Hevy — strength logging, programs, progress, social

- `[HAVE]` Live set logger with warmup / drop / failure set types, supersets, rest timer.
- `[HAVE]` Exercise library with demonstrations and how-to instructions.
- `[HAVE]` Muscle-group volume / distribution breakdown (FitMerge has muscle balance in training stats).
- `[PARTIAL]` Per-exercise progress charts: heaviest weight, best set volume, session volume, most reps, best time. FitMerge has lifetime totals + weekly frequency but not per-exercise progression graphs.
- `[GAP]` **Estimated 1RM per exercise over time** (projected & true 1RM tracked as a first-class metric).
- `[GAP]` **Pre-made programs / plans library** — body-part splits, beginner programs, equipment-specific, multi-week structured routines you can start.
- `[GAP]` **Automatic PR detection & celebration** (weight PR, rep PR, volume PR, 1RM PR flagged live in the logger).
- `[GAP]` Social feed / following / shareable workout cards.
- `[HAVE]` Cross-device cloud sync (FitMerge has Firebase sync).

## 2. Strong — logging UX, plate calc, progress, templates

- `[HAVE]` Fast set-by-set logging with previous-set reference and plate calculator.
- `[HAVE]` Reusable workout templates / routines (user-built).
- `[HAVE]` Multiple exercise types incl. duration and bodyweight/assisted.
- `[PARTIAL]` Advanced statistics: PRs, 1RM calc, total weight lifted, progression graphs. FitMerge has lifetime totals but not the per-lift progression/PR views.
- `[GAP]` **Estimated 1RM and total-volume trend graphs** as the headline "are you getting stronger" view.
- `[GAP]` Per-muscle-group volume analytics over time (Strong Premium) — FitMerge has a static balance view, not a trend.
- `[HAVE]` Imperial/metric support, cloud sync.
- `[GAP]` CSV / data export.

## 3. Garmin Connect & Garmin Coach — endurance metrics

- `[HAVE]` Daily metrics ingest: steps, sleep, resting HR, HRV, stress, body battery, VO2max, SpO2, intensity minutes (FitMerge already imports all of these).
- `[HAVE]` Training load per activity + training-status-style analytics (CTL/ATL/TSB is FitMerge's equivalent of Training Status).
- `[PARTIAL]` VO2max trend — FitMerge imports vo2max daily but does not chart it over time.
- `[GAP]` **Pace / speed trends per activity type over time** (running/cycling/walking pace progression) — the flagship missing chart given the user's data mix.
- `[GAP]` **Race Predictor** — predicted 5K/10K/half/marathon times derived from VO2max + training history.
- `[GAP]` **Training Readiness score** — a single daily "should I train hard today" number blending sleep, HRV, recovery, acute load (FitMerge has all inputs already).
- `[GAP]` Running dynamics (cadence, ground contact, vertical oscillation, grade-adjusted pace) — only if source data exists.
- `[GAP]` **Garmin Coach-style adaptive daily suggested workout** — recommends today's session and auto-inserts recovery after poor sleep/high load.
- `[GAP]` PacePro-style pacing strategy for a target distance.

## 4. TrainingPeaks — PMC, structured workouts, annual plan

- `[HAVE]` **Performance Management Chart (CTL / ATL / TSB)** — FitMerge already has the gold-standard model; this is a genuine strength vs Hevy/Strong.
- `[HAVE]` Fitness/Fatigue/Form framing and forward projection.
- `[PARTIAL]` Training Stress Score input — FitMerge uses per-activity trainingLoad, functionally similar to TSS, but has no explicit TSS-per-workout builder for strength sessions.
- `[GAP]` **Structured workout builder** — prescribe intervals with pace/HR/power targets, then score compliance.
- `[GAP]` **Annual Training Plan (ATP)** — periodized multi-week/multi-month plan with planned vs actual CTL, ramp rate, and phases (base/build/peak/taper).
- `[GAP]` Planned vs actual load view (target CTL ramp rate 3–8/week, planned TSS vs completed).
- `[GAP]` Event/goal-based countdown planning (peak for a race date).

## 5. MacroFactor / MyFitnessPal — nutrition (brief)

- `[HAVE]` Photo→macros (Gemini), food search, macro diary, water tracking.
- `[GAP]` **Adaptive TDEE / expenditure algorithm** — model real energy expenditure from logged intake + weigh-in trend and auto-recalibrate macro targets. FitMerge already has both inputs (food diary + Garmin/Progress weigh-ins) — high-fit, high-value.
- `[GAP]` **Weight-trend smoothing** (moving-average trend line vs noisy daily scale) and calorie/weight correlation.
- `[PARTIAL]` Large food database — FitMerge has search + photo; depth vs MFP's 14M entries unknown.
- `[GAP]` "Describe your meal" natural-language logging and recipe-URL import (partly covered by photo→macros).
- `[HAVE]` Fast logging via photo (fewer taps, MacroFactor-style advantage).

## 6. Strava & Fitbod (optional)

- `[GAP]` (Strava) Activity feed / kudos / following — social layer.
- `[GAP]` (Strava) Segments & leaderboards / personal segment PRs — needs GPS track data.
- `[HAVE]` (Strava) Per-activity detail view (FitMerge has the underlying activity records).
- `[GAP]` (Fitbod) **Auto-generated workout** from training history, goals, equipment, and muscle-recovery %.
- `[PARTIAL]` (Fitbod) **Muscle-recovery model** (0–100% freshness per muscle group) — FitMerge has the training data + body battery to build this but doesn't surface per-muscle recovery.

---

## Top gaps (consolidated)

| Feature | Apps that have it | User value | Effort | Depends on |
|---|---|---|---|---|
| Cardio pace/speed trend charts (per activity type) | Garmin, Strava, TrainingPeaks | Very high (most of user's data is cardio) | **S** | health.distanceKm, session.durationMin, activity type |
| e1RM-over-time per exercise | Hevy, Strong | Very high | **S** | existing set logs (weight×reps) |
| Total-volume & PR progression per exercise | Hevy, Strong | High | **S** | existing set logs |
| Automatic PR detection in logger | Hevy, Strong | High | **S** | set logs + e1RM formula |
| Pre-built program/plan library | Hevy, Fitbod, Garmin Coach | Very high (flagged) | **M** | routine schema → multi-week wrapper |
| Structured multi-week plan w/ scheduling | TrainingPeaks, Garmin Coach | High (flagged) | **M/L** | program library + calendar |
| Distance/duration/elevation trend charts | Garmin, Strava | High | **S** | health.distanceKm, durationMin |
| VO2max trend chart | Garmin | Medium | **S** | health.vo2max (already imported) |
| Race predictor (5K/10K/HM/M) | Garmin | Medium-high | **M** | vo2max + recent pace history |
| Training Readiness daily score | Garmin | High | **M** | sleep, HRV, restingHr, TSB, bodyBattery |
| Adaptive TDEE + weight-trend smoothing | MacroFactor | High | **M** | food diary + weigh-ins |
| Muscle-recovery % model | Fitbod | Medium | **M** | per-muscle volume + recency |
| Auto-generated workout | Fitbod | Medium | **L** | recovery model + exercise library |
| Structured workout builder (intervals) | TrainingPeaks, Garmin | Medium | **L** | new workout data type |
| Social feed / sharing | Hevy, Strava | Low-medium | **L** | new social backend, privacy |

---

## Roadmap status

Audited against the codebase on 2026-07-25. The original 15-item roadmap was written
on 2026-07-24 and much of it shipped the same week, so this replaces it: the status
column is what the code actually does, not what was planned. Evidence is the
implementing file. Re-audit before trusting it — it goes stale fast.

| # | Item | Status | Where it lives / what's missing |
|---|---|---|---|
| 1 | Cardio pace-trend chart | **Done** | `features/workouts/cardio.ts` → `CardioProgressSection`. Trend is a weekly/monthly bucketed average, not a per-session moving average |
| 2 | e1RM-over-time per exercise | **Done** | `epley1RM` in `progress/utils.ts`, charted in `ExerciseProgressSheet` |
| 3 | Volume & rep-PR progression | **Partial** | Lifetime tonnage, best-set tiles and an all-time e1RM board exist. Missing: per-exercise session-volume and heaviest-weight *trend lines*, and rep-PRs (max reps at load) — `personalRecords` ranks by e1RM only |
| 4 | Automatic PR detection in the logger | **Done** | `prDetect.ts` → `ActiveSession` → `PRToast`; 1RM/weight/volume/tonnage milestones, 11 tests. Only the optional persisted PR-history feed is absent |
| 5 | Distance / duration / elevation trends | **Partial** | Distance, duration and kcal are charted. **Elevation is collected but not chartable** — add `'elevation'` to `CardioMetricKey` in `cardio.ts` |
| 6 | VO2max trend + Race Predictor | **Done** | `racePrediction.ts` (Riegel + Daniels VDOT, per-prediction confidence), 44 tests; VO2max charted via `healthMetrics.ts` |
| 7 | Pre-built program library | **Done** | `data/programs.ts` (5 templates) → `ProgramLibrary` → `installProgramTemplate`. Strength-only — no couch-to-5K or cardio plans |
| 8 | Multi-week plan + calendar | **Partial** | Programs have weeks, %-complete and "up next" (`ProgramDetail`). Missing: **any calendar** — days are ordinal, never assigned to dates. No planned-vs-actual, no cardio in plans, no tie-in to the CTL/ATL/TSB projection |
| 9 | Training Readiness score | **Partial (weak)** | `heroScore` merely *picks* Garmin's imported bodyBattery → trainingReadiness → sleepScore. No FitMerge-computed blend of sleep + HRV-vs-baseline + RHR + TSB, so non-Garmin users get nothing |
| 10 | Adaptive TDEE + weight smoothing | **Partial** | Weight-trend EMA is done (`weightTrends.ts`). Adaptive TDEE is **not**: `lib/tdee.ts` is static Mifflin-St Jeor × activity multiplier, with no intake-vs-weight-change fit and no macro recalibration |
| 11 | Muscle-recovery % model | **Not built** | `MuscleMap` exists but only highlights an exercise's anatomy. No freshness/recency-decay model |
| 12 | Coach-style daily suggestion | **Partial** | `services/coach/` produces a train/recover/rest plan from 5-day context and can launch it. But it's an LLM call (needs a Gemini key), ignores the active Program, and can't swap a scheduled day |
| 13 | Auto-generated workout | **Partial** | Same coach code as 12, constrained to the real exercise library and equipment. No deterministic ranking, no recovery input, no entry point outside the coach sheet |
| 14 | Structured interval builder | **Not built** | `RoutineItem` is sets/reps/rest only; no pace/HR targets, no compliance scoring |
| 15 | Social / sharing | **Not built** | No share cards, no feed. `ActivityFeedSection` is the user's own private list |

### Engineering health

| Item | Status | Detail |
|---|---|---|
| Tests | **Partial** | Vitest 2.1.9, 9 files, 375 cases — all pure logic (cardio, race prediction, PR detect, training load, TDEE, units, exercise). **Zero component, store, or sync tests**; the hand-rolled `healthImport/garminCsv.ts` parser is untested |
| CSV export | **Not built** | `dataBackup.ts` exports JSON only. All CSV code is import-side |
| Error monitoring | **Not built** | No Sentry, no `ErrorBoundary`, no `window.onerror`. An unhandled render error white-screens the PWA with no signal |
| Bundle / splitting | **Partial** | Routes are `React.lazy`, and Firebase / ZXing / the food DB are behind dynamic imports. Missing: no `manualChunks` in `vite.config.ts`, so vendor code isn't shared across route chunks; no size budget |
| Branch name | **Open** | Default branch is still `claude/fitness-app-macros-workouts-z46rpp`; `deploy-pages.yml` hardcodes it, so renaming without editing that stops deploys |

### What's actually next

Ordered by value ÷ effort against the *current* code:

1. **Finish elevation trends** (XS) — one key in `CardioMetricKey`; the data is already imported and summarised.
2. **Error monitoring + an ErrorBoundary** (S) — today a crash is invisible and unreportable. The React crash found in review on 2026-07-25 would have been caught by users, not telemetry.
3. **Training Readiness as a real score** (M) — the single biggest "works for everyone" gap: every input is already stored, and it currently degrades to nothing without a Garmin.
4. **Adaptive TDEE** (M) — the highest-value feature still genuinely missing. Both inputs (intake, smoothed weight trend) are already held; only the expenditure fit is absent.
5. **Per-exercise volume/weight trend lines + rep-PRs** (S–M) — finishes item 3 with data already logged.
6. **Calendar for programs** (M/L) — the missing half of item 8, and the thing that would let planned load feed the PMC projection.
7. **CSV export** (S) — escape hatch from lock-in; cheap.
8. **Component/store test coverage** (M) — every bug found in the 2026-07-25 review was in UI or store logic, which currently has no test coverage at all.
9. **Muscle-recovery model** (M) — unlocks a deterministic version of 12 and 13.

Items 14 and 15 remain low priority: an interval builder needs a new data type, and social carries backend and privacy cost tangential to the analytics-first positioning.

---

## Sources

- Hevy: https://www.hevyapp.com/features/ , https://www.hevyapp.com/features/gym-performance/ , https://www.hevyapp.com/features/training-chart/
- Strong: https://www.strong.app/ , App Store listing
- Garmin: https://the5krunner.com/garmin-features/ , https://www.garmin.com/en-US/garmin-coach/overview/ , Garmin support (VO2max, Race Predictor)
- TrainingPeaks: https://www.trainingpeaks.com/coach-blog/a-coachs-guide-to-atl-ctl-tsb/ , https://www.trainingpeaks.com/learn/articles/the-comprehensive-guide-to-creating-an-annual-training-plan/
- MacroFactor/MyFitnessPal: https://macrofactor.com/macrofactor-vs-myfitnesspal-2025/
- Fitbod: https://fitbod.me/blog/fitbod-algorithm/ , https://fitbod.me/blog/muscle-recovery/
- Strava: https://support.strava.com/hc/en-us/articles/216918167-Strava-Segments

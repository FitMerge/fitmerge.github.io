# Rung Competitive Analysis & Gap Roadmap

_Last updated: 2026-07-13_

## Intro

Rung is a mobile-first fitness PWA that fuses three normally-separate products: nutrition tracking (MyFitnessPal/MacroFactor style), strength logging (Hevy/Strong style), and endurance/health analytics (Garmin + TrainingPeaks style). Its differentiator is that it already owns the hard, coach-grade endurance layer — CTL/ATL/TSB performance-management chart, ACWR injury risk, HR-vs-HRV, intensity distribution, forward projection, plus 1985 days of Garmin daily metrics and 1010 activities with per-activity training load. That analytics moat is ahead of Hevy/Strong.

The gaps are concentrated in three areas the user already flagged: (a) no pre-built training **programs** to pick from, (b) no **cardio progression charts** (pace/distance/duration trends) despite most of the user's data being walk/run/cycle activities, and (c) no explicit **"improvement" tracking** (pace, total volume, e1RM over time). This doc benchmarks six best-in-class apps, tags each signature feature relative to Rung's current state, consolidates the gaps, and lays out a prioritized, buildable roadmap.

Legend: **`[HAVE]`** = shipped, **`[PARTIAL]`** = partially present / data exists but not surfaced, **`[GAP]`** = missing.

---

## 1. Hevy — strength logging, programs, progress, social

- `[HAVE]` Live set logger with warmup / drop / failure set types, supersets, rest timer.
- `[HAVE]` Exercise library with demonstrations and how-to instructions.
- `[HAVE]` Muscle-group volume / distribution breakdown (Rung has muscle balance in training stats).
- `[PARTIAL]` Per-exercise progress charts: heaviest weight, best set volume, session volume, most reps, best time. Rung has lifetime totals + weekly frequency but not per-exercise progression graphs.
- `[GAP]` **Estimated 1RM per exercise over time** (projected & true 1RM tracked as a first-class metric).
- `[GAP]` **Pre-made programs / plans library** — body-part splits, beginner programs, equipment-specific, multi-week structured routines you can start.
- `[GAP]` **Automatic PR detection & celebration** (weight PR, rep PR, volume PR, 1RM PR flagged live in the logger).
- `[GAP]` Social feed / following / shareable workout cards.
- `[HAVE]` Cross-device cloud sync (Rung has Firebase sync).

## 2. Strong — logging UX, plate calc, progress, templates

- `[HAVE]` Fast set-by-set logging with previous-set reference and plate calculator.
- `[HAVE]` Reusable workout templates / routines (user-built).
- `[HAVE]` Multiple exercise types incl. duration and bodyweight/assisted.
- `[PARTIAL]` Advanced statistics: PRs, 1RM calc, total weight lifted, progression graphs. Rung has lifetime totals but not the per-lift progression/PR views.
- `[GAP]` **Estimated 1RM and total-volume trend graphs** as the headline "are you getting stronger" view.
- `[GAP]` Per-muscle-group volume analytics over time (Strong Premium) — Rung has a static balance view, not a trend.
- `[HAVE]` Imperial/metric support, cloud sync.
- `[GAP]` CSV / data export.

## 3. Garmin Connect & Garmin Coach — endurance metrics

- `[HAVE]` Daily metrics ingest: steps, sleep, resting HR, HRV, stress, body battery, VO2max, SpO2, intensity minutes (Rung already imports all of these).
- `[HAVE]` Training load per activity + training-status-style analytics (CTL/ATL/TSB is Rung's equivalent of Training Status).
- `[PARTIAL]` VO2max trend — Rung imports vo2max daily but does not chart it over time.
- `[GAP]` **Pace / speed trends per activity type over time** (running/cycling/walking pace progression) — the flagship missing chart given the user's data mix.
- `[GAP]` **Race Predictor** — predicted 5K/10K/half/marathon times derived from VO2max + training history.
- `[GAP]` **Training Readiness score** — a single daily "should I train hard today" number blending sleep, HRV, recovery, acute load (Rung has all inputs already).
- `[GAP]` Running dynamics (cadence, ground contact, vertical oscillation, grade-adjusted pace) — only if source data exists.
- `[GAP]` **Garmin Coach-style adaptive daily suggested workout** — recommends today's session and auto-inserts recovery after poor sleep/high load.
- `[GAP]` PacePro-style pacing strategy for a target distance.

## 4. TrainingPeaks — PMC, structured workouts, annual plan

- `[HAVE]` **Performance Management Chart (CTL / ATL / TSB)** — Rung already has the gold-standard model; this is a genuine strength vs Hevy/Strong.
- `[HAVE]` Fitness/Fatigue/Form framing and forward projection.
- `[PARTIAL]` Training Stress Score input — Rung uses per-activity trainingLoad, functionally similar to TSS, but has no explicit TSS-per-workout builder for strength sessions.
- `[GAP]` **Structured workout builder** — prescribe intervals with pace/HR/power targets, then score compliance.
- `[GAP]` **Annual Training Plan (ATP)** — periodized multi-week/multi-month plan with planned vs actual CTL, ramp rate, and phases (base/build/peak/taper).
- `[GAP]` Planned vs actual load view (target CTL ramp rate 3–8/week, planned TSS vs completed).
- `[GAP]` Event/goal-based countdown planning (peak for a race date).

## 5. MacroFactor / MyFitnessPal — nutrition (brief)

- `[HAVE]` Photo→macros (Gemini), food search, macro diary, water tracking.
- `[GAP]` **Adaptive TDEE / expenditure algorithm** — model real energy expenditure from logged intake + weigh-in trend and auto-recalibrate macro targets. Rung already has both inputs (food diary + Garmin/Progress weigh-ins) — high-fit, high-value.
- `[GAP]` **Weight-trend smoothing** (moving-average trend line vs noisy daily scale) and calorie/weight correlation.
- `[PARTIAL]` Large food database — Rung has search + photo; depth vs MFP's 14M entries unknown.
- `[GAP]` "Describe your meal" natural-language logging and recipe-URL import (partly covered by photo→macros).
- `[HAVE]` Fast logging via photo (fewer taps, MacroFactor-style advantage).

## 6. Strava & Fitbod (optional)

- `[GAP]` (Strava) Activity feed / kudos / following — social layer.
- `[GAP]` (Strava) Segments & leaderboards / personal segment PRs — needs GPS track data.
- `[HAVE]` (Strava) Per-activity detail view (Rung has the underlying activity records).
- `[GAP]` (Fitbod) **Auto-generated workout** from training history, goals, equipment, and muscle-recovery %.
- `[PARTIAL]` (Fitbod) **Muscle-recovery model** (0–100% freshness per muscle group) — Rung has the training data + body battery to build this but doesn't surface per-muscle recovery.

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

## Prioritized roadmap (value ÷ effort, highest first)

These are ordered so the fast, high-value "improvement tracking" wins ship first (they reuse data Rung already stores), then the flagged program/plan work, then the higher-effort intelligence layers.

1. **Cardio pace-trend chart** _(S, very high)_ — Derive `pace = session.durationMin ÷ health.distanceKm` (min/km) per activity, group by activity type (run/walk/cycle), and plot over time with a moving-average trend. This is the single biggest gap given the user's data mix and it needs zero new data. Add a per-type toggle and a "faster/slower vs 30-day avg" delta.

2. **e1RM-over-time per exercise** _(S, very high)_ — Compute Epley `e1RM = weight × (1 + reps/30)` for every logged set, take the daily best per exercise, and chart the trend. This is the headline "am I getting stronger" view and directly answers the user's estimated-1RM ask. Reuses existing set logs entirely.

3. **Total-volume & rep-PR progression per exercise** _(S, high)_ — For each exercise chart session volume (`Σ weight×reps`), heaviest weight, and best set; store running PRs (max weight, max reps@target, max volume, max e1RM). Pure aggregation over existing logs.

4. **Automatic PR detection in the live logger** _(S, high)_ — On set save, compare against stored PRs and flash a PR badge (weight/rep/volume/e1RM) inline. High dopamine, cheap; reuses items 2–3. Persist a PR history feed.

5. **Distance / duration / elevation trend charts** _(S, high)_ — Sibling to item 1: weekly distance totals, longest activity, and duration trends per activity type from `health.distanceKm` + `durationMin`. Bundle with pace as a "Cardio Progress" tab.

6. **VO2max trend + Race Predictor** _(S→M, medium-high)_ — Chart already-imported `health.vo2max` over time. Then predict 5K/10K/half/marathon using a VO2max→velocity model (e.g. Riegel/Daniels) refined against the user's recent best paces from item 1. Frames endurance improvement the way Garmin does.

7. **Pre-built program/plan library** _(M, very high — user-flagged)_ — Wrap the existing routine schema in a `Program = ordered list of routine templates + week/day scheduling`. Ship a starter catalog (e.g. PPL, Upper/Lower, 5×5, beginner full-body, couch-to-5K) users can browse and "Start", which clones routines into their library and schedules them. Reuses the routine builder; the new part is the program container + a catalog.

8. **Structured multi-week training plan + calendar** _(M/L, high — user-flagged)_ — Layer scheduling on item 7: assign program days to calendar dates, show planned-vs-completed, and support strength + cardio in one plan (base/build/peak/taper phases). Tie planned load into the existing CTL/ATL/TSB projection so the plan drives the PMC forward curve — a differentiator no strength app has.

9. **Training Readiness daily score** _(M, high)_ — Blend already-imported `sleep`, `HRV` (vs baseline), `restingHr`, `stress`, `bodyBattery`, and current `TSB`/ACWR into a single 0–100 "train hard / go easy / recover" number with a plain-language reason. All inputs already exist; this is a scoring function + a card on the dashboard.

10. **Adaptive TDEE + weight-trend smoothing** _(M, high)_ — Fit an expenditure model from the macro diary (calories in) against the smoothed weigh-in trend (exponential moving average of Garmin/Progress weight), then auto-suggest macro targets that adapt as expenditure shifts — the MacroFactor moat, using data Rung already has on both sides. Ship the weight-trend line first as a quick win.

11. **Muscle-recovery % model** _(M, medium)_ — Assign each muscle group a 0–100% freshness score from recent set volume + recency decay (and optionally `bodyBattery`). Surface as a body-map heat overlay reusing the existing muscle-map component. Feeds items 8 and 12.

12. **Garmin Coach-style daily suggested workout** _(M→L, medium)_ — Recommend today's session from the active plan (item 8), Training Readiness (item 9), and muscle recovery (item 11); auto-swap in a recovery/easy day after poor sleep or high ACWR. Adaptive coaching layer that unifies strength + cardio.

13. **Fitbod-style auto-generated workout** _(L, medium)_ — Given goal, available equipment, and the recovery model (item 11), rank the exercise library and assemble a full session. Good "no plan today?" fallback; depends on 11.

14. **Structured workout builder (intervals)** _(L, medium)_ — New workout type: ordered intervals with pace/HR targets (e.g. 6×800m @ 4:30/km). Enables TrainingPeaks-grade prescription and compliance scoring against imported activity data.

15. **Social / sharing layer** _(L, low-medium)_ — Shareable workout/PR cards first (cheap, viral), then an opt-in follow feed. Lowest priority: high backend + privacy cost, tangential to the analytics-first positioning.

### Sequencing note
Items 1–6 are a fast "Improvement Tracking" release that ships in days from data already stored and closes gaps (b) and (c). Items 7–8 close gap (a) and the multi-week-plan ask. Items 9–14 build the adaptive-coaching intelligence layer that turns Rung's analytics moat into daily guidance. Item 15 is optional.

---

## Sources

- Hevy: https://www.hevyapp.com/features/ , https://www.hevyapp.com/features/gym-performance/ , https://www.hevyapp.com/features/training-chart/
- Strong: https://www.strong.app/ , App Store listing
- Garmin: https://the5krunner.com/garmin-features/ , https://www.garmin.com/en-US/garmin-coach/overview/ , Garmin support (VO2max, Race Predictor)
- TrainingPeaks: https://www.trainingpeaks.com/coach-blog/a-coachs-guide-to-atl-ctl-tsb/ , https://www.trainingpeaks.com/learn/articles/the-comprehensive-guide-to-creating-an-annual-training-plan/
- MacroFactor/MyFitnessPal: https://macrofactor.com/macrofactor-vs-myfitnesspal-2025/
- Fitbod: https://fitbod.me/blog/fitbod-algorithm/ , https://fitbod.me/blog/muscle-recovery/
- Strava: https://support.strava.com/hc/en-us/articles/216918167-Strava-Segments

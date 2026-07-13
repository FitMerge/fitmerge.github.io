#!/usr/bin/env python3
"""garmin-sync.py — pull recent weigh-ins and activities from Garmin Connect and emit a
FitMerge health-import JSON file (version 1), importable from FitMerge's Settings ->
"Connect health data".

Usage:
    pip install garminconnect
    python3 scripts/garmin-sync.py --days 90 --out fitmerge-import.json

Credentials come from the GARMIN_EMAIL / GARMIN_PASSWORD environment variables, or you'll be
prompted for them. Session tokens are cached by the underlying `garth` library at
~/.garminconnect so you won't be re-prompted every run.

Run `python3 scripts/garmin-sync.py --self-test` to validate the JSON-building logic offline
(no network, no garminconnect dependency needed) — this is what CI / verification runs.

Output schema (FitMerge JSON, version 1):
    {
      "version": 1,
      "weights": [{"date": "YYYY-MM-DD", "weightKg": number, "bodyFatPct"?: number}],
      "sessions": [{"name": string, "date": "YYYY-MM-DD", "durationMin"?: number, "kcal"?: number,
                    "trainingLoad"?: number}],
      "health":  [{"date": "YYYY-MM-DD", "metrics": {"steps": number, "restingHr": number,
                    "sleepMinutes": number, "sleepScore": number, "stress": number,
                    "bodyBattery": number, "hrv": number, "spo2": number, "vo2max": number,
                    "trainingReadiness": number, "enduranceScore": number, "hillScore": number,
                    "fitnessAge": number, "raceTime5k": number, "bmi": number, ...}}]
    }

Metrics pulled per day: steps, floors, active/total calories, resting & max HR, average &
max stress, Body Battery (level + high/low/charged/drained), intensity minutes (moderate +
vigorous), distance, sleep (total/deep/REM/light/awake + score), HRV, Pulse Ox (avg + low),
respiration (avg/min/max), VO₂ max (running + cycling), training readiness, and — weekly —
training-status acute load, endurance score, hill score, fitness age, and 5K/10K/half/marathon
race-time predictions. Body-composition detail (BMI, muscle & bone mass, body water, visceral
fat, metabolic age, physique rating) is folded in from the weigh-in feed.

The "metrics" bag is open-ended: any numeric field is imported and displayed, so new Garmin
metrics need no code change on either side.
"""

import argparse
import getpass
import json
import os
import re
import sys
import time
from datetime import date, timedelta

DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def build_payload(weights, sessions, health=None):
    """Assembles + validates the version-1 FitMerge JSON payload from already-shaped rows."""
    health = health or []
    clean_weights = []
    for w in weights:
        d = w.get("date")
        weight_kg = w.get("weightKg")
        if not isinstance(d, str) or not DATE_RE.match(d):
            continue
        if not isinstance(weight_kg, (int, float)) or weight_kg <= 0:
            continue
        row = {"date": d, "weightKg": round(float(weight_kg), 2)}
        fat = w.get("bodyFatPct")
        if isinstance(fat, (int, float)) and fat > 0:
            row["bodyFatPct"] = round(float(fat), 1)
        clean_weights.append(row)

    clean_sessions = []
    for s in sessions:
        d = s.get("date")
        name = s.get("name")
        if not isinstance(d, str) or not DATE_RE.match(d):
            continue
        if not isinstance(name, str) or not name.strip():
            continue
        row = {"name": name.strip(), "date": d}
        duration = s.get("durationMin")
        if isinstance(duration, (int, float)) and duration >= 0:
            row["durationMin"] = round(float(duration), 1)
        kcal = s.get("kcal")
        if isinstance(kcal, (int, float)) and kcal >= 0:
            row["kcal"] = round(float(kcal))
        training_load = s.get("trainingLoad")
        if isinstance(training_load, (int, float)) and training_load >= 0:
            row["trainingLoad"] = round(float(training_load), 1)
        distance_km = s.get("distanceKm")
        if isinstance(distance_km, (int, float)) and distance_km > 0:
            row["distanceKm"] = round(float(distance_km), 3)
        clean_sessions.append(row)

    clean_health = []
    for h in health:
        d = h.get("date")
        if not isinstance(d, str) or not DATE_RE.match(d):
            continue
        metrics = {}
        for k, v in (h.get("metrics") or {}).items():
            # bools are ints in Python — exclude them; keep only finite numbers.
            if isinstance(v, bool) or not isinstance(v, (int, float)):
                continue
            metrics[str(k)] = round(float(v), 3)
        if metrics:
            clean_health.append({"date": d, "metrics": metrics})

    return {"version": 1, "weights": clean_weights, "sessions": clean_sessions, "health": clean_health}


def fetch_from_garmin(days):
    try:
        from garminconnect import Garmin
    except ImportError:
        print("error: the garminconnect package is required — run: pip install garminconnect", file=sys.stderr)
        sys.exit(1)

    email = os.environ.get("GARMIN_EMAIL") or input("Garmin email: ")
    password = os.environ.get("GARMIN_PASSWORD") or getpass.getpass("Garmin password: ")

    def prompt_mfa():
        # Called only when the account has two-factor enabled. Garmin sends a code
        # (email or authenticator app); we read it from the terminal.
        return input("Garmin 2-factor code (check your email / authenticator app): ").strip()

    # Newer garminconnect versions accept a prompt_mfa callback so two-factor
    # accounts can finish login interactively; older ones don't take the kwarg.
    try:
        client = Garmin(email=email, password=password, prompt_mfa=prompt_mfa)
    except TypeError:
        client = Garmin(email, password)

    client.login()  # garth caches the session token under ~/.garminconnect after this

    end = date.today()
    start = end - timedelta(days=days)
    start_str, end_str = start.isoformat(), end.isoformat()

    weights = []
    body_comp = None
    for method_name in ("get_body_composition", "get_weigh_ins"):
        method = getattr(client, method_name, None)
        if method is None:
            continue
        try:
            body_comp = method(start_str, end_str)
            break
        except Exception:
            continue

    # Body-composition detail (BMI, muscle/bone mass, body water, visceral fat,
    # metabolic age, physique rating) rides in as daily health metrics keyed by date.
    bodycomp_metrics = {}
    for entry in (body_comp or {}).get("dateWeightList", []) if isinstance(body_comp, dict) else (body_comp or []):
        calendar_date = entry.get("calendarDate") or entry.get("date")
        weight_grams = entry.get("weight")
        if calendar_date is None or weight_grams is None:
            continue
        ds = str(calendar_date)[:10]
        row = {"date": ds, "weightKg": weight_grams / 1000.0}
        body_fat = entry.get("bodyFat")
        if body_fat:
            row["bodyFatPct"] = body_fat
        weights.append(row)

        detail = {}

        def _bc(dst, *keys):
            for k in keys:
                v = entry.get(k)
                if isinstance(v, (int, float)) and not isinstance(v, bool) and v > 0:
                    detail[dst] = v
                    return

        _bc("bmi", "bmi")
        _bc("muscleMassKg", "muscleMass")  # grams on some accounts → normalised below
        _bc("boneMassKg", "boneMass")
        _bc("bodyWaterPct", "bodyWater")
        _bc("physiqueRating", "physiqueRating")
        _bc("visceralFat", "visceralFat", "visceralFatRating")
        _bc("metabolicAge", "metabolicAge")
        # Garmin reports muscle/bone mass in grams; convert anything implausibly large to kg.
        for k in ("muscleMassKg", "boneMassKg"):
            if k in detail and detail[k] > 200:
                detail[k] = detail[k] / 1000.0
        if detail:
            bodycomp_metrics[ds] = detail

    sessions = []
    activities = client.get_activities_by_date(start_str, end_str) or []
    for act in activities:
        name = act.get("activityName") or (act.get("activityType") or {}).get("typeKey") or "Workout"
        start_local = act.get("startTimeLocal") or ""
        duration_sec = act.get("duration")
        row = {"name": name, "date": str(start_local)[:10]}
        if isinstance(duration_sec, (int, float)):
            row["durationMin"] = duration_sec / 60.0
        calories = act.get("calories")
        if isinstance(calories, (int, float)):
            row["kcal"] = calories
        # Garmin's own training-load number for the activity (a proper TSS-like
        # value). When present it calibrates the fitness/fatigue (PMC) curves far
        # better than the calorie estimate the app falls back to.
        training_load = act.get("activityTrainingLoad") or act.get("trainingLoad")
        if isinstance(training_load, (int, float)) and training_load > 0:
            row["trainingLoad"] = training_load
        # Distance in metres → km, for pace/distance progression charts.
        distance_m = act.get("distance")
        if isinstance(distance_m, (int, float)) and distance_m > 0:
            row["distanceKm"] = distance_m / 1000.0
        sessions.append(row)

    health = fetch_daily_metrics(client, end, days)
    # Fold body-composition detail into the matching health day.
    by_date = {h["date"]: h["metrics"] for h in health}
    for ds, detail in bodycomp_metrics.items():
        by_date.setdefault(ds, {}).update(detail)
    health = [{"date": d, "metrics": m} for d, m in by_date.items()]
    return weights, sessions, health


def _first_num(d, *keys):
    """First numeric (non-bool, finite) value among candidate keys of a dict."""
    if not isinstance(d, dict):
        return None
    for k in keys:
        v = d.get(k)
        if isinstance(v, (int, float)) and not isinstance(v, bool):
            return v
    return None


def _deep_num(obj, *names, _depth=0):
    """Search a nested dict/list for the first numeric value whose key exactly matches
    one of `names`. Garmin buries values like acute load under varying wrapper keys
    across firmware/library versions, so a defensive scan keeps us robust."""
    if _depth > 6:
        return None
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k in names and isinstance(v, (int, float)) and not isinstance(v, bool):
                return v
        for v in obj.values():
            found = _deep_num(v, *names, _depth=_depth + 1)
            if found is not None:
                return found
    elif isinstance(obj, list):
        for v in obj:
            found = _deep_num(v, *names, _depth=_depth + 1)
            if found is not None:
                return found
    return None


def fetch_slow_metrics(call, ds, put):
    """Pull the slow-moving performance metrics for one date: training status (acute
    load), endurance score, hill score, fitness age, and race-time predictions. Every
    endpoint name/shape varies across garminconnect versions, so each is probed with
    several method names and the value is deep-scanned defensively."""
    # Training status → acute (7-day) training load.
    for m in ("get_training_status",):
        st = call(m, ds)
        if st is not None:
            put(ds, "acuteLoad", _deep_num(st, "acuteTrainingLoad", "acwrAcute", "dailyAcuteChronicWorkloadRatio"))
            break

    # Endurance score.
    for m in ("get_endurance_score",):
        es = call(m, ds, ds) if m == "get_endurance_score" else call(m, ds)
        if es is not None:
            put(ds, "enduranceScore", _deep_num(es, "overallScore", "enduranceScore", "score"))
            break

    # Hill score.
    for m in ("get_hill_score",):
        hs = call(m, ds, ds)
        if hs is not None:
            put(ds, "hillScore", _deep_num(hs, "overallScore", "hillScore", "score"))
            break

    # Fitness age (endpoint name differs across library versions).
    for m in ("get_fitnessage_data", "get_fitness_age"):
        fa = call(m, ds)
        if fa is not None:
            put(ds, "fitnessAge", _deep_num(fa, "fitnessAge", "achievableFitnessAge", "bioAge"))
            break

    # Race-time predictions (seconds) for 5K / 10K / half / marathon.
    rpred = call("get_race_predictions")
    row = rpred[-1] if isinstance(rpred, list) and rpred else (rpred if isinstance(rpred, dict) else {})
    if isinstance(row, dict):
        put(ds, "raceTime5k", _first_num(row, "time5K", "time5k"))
        put(ds, "raceTime10k", _first_num(row, "time10K", "time10k"))
        put(ds, "raceTimeHalf", _first_num(row, "timeHalfMarathon", "timeHalf"))
        put(ds, "raceTimeMarathon", _first_num(row, "timeMarathon"))


def fetch_daily_metrics(client, end, days):
    """Pull every daily wellness metric Garmin exposes, one day at a time. Every call is
    wrapped defensively so a missing endpoint or a day with no data never aborts the run."""
    by_date = {}

    def put(ds, key, val):
        if val is None or isinstance(val, bool) or not isinstance(val, (int, float)):
            return
        by_date.setdefault(ds, {})[key] = val

    def call(method_name, *a):
        m = getattr(client, method_name, None)
        if m is None:
            return None
        # On a long multi-month pull Garmin can rate-limit (429) partway through.
        # Rather than silently dropping the day, back off and retry a few times;
        # only give up (return None) on a non-rate-limit error or after retries.
        for attempt in range(4):
            try:
                return m(*a)
            except Exception as e:
                msg = str(e).lower()
                if "429" in msg or "rate" in msg or "too many" in msg:
                    time.sleep(5 * (attempt + 1))
                    continue
                return None
        return None

    total = days + 1
    for i in range(total):
        ds = (end - timedelta(days=i)).isoformat()

        st = call("get_stats", ds) or {}
        if isinstance(st, dict):
            put(ds, "steps", st.get("totalSteps"))
            put(ds, "floors", st.get("floorsAscended"))
            put(ds, "activeCalories", st.get("activeKilocalories"))
            put(ds, "totalCalories", st.get("totalKilocalories"))
            put(ds, "restingHr", st.get("restingHeartRate"))
            put(ds, "maxHr", st.get("maxHeartRate"))
            put(ds, "stress", st.get("averageStressLevel"))
            put(ds, "bodyBattery", st.get("bodyBatteryMostRecentValue") or st.get("bodyBatteryHighestValue"))
            mod = st.get("moderateIntensityMinutes") or 0
            vig = st.get("vigorousIntensityMinutes") or 0
            if mod or vig:
                put(ds, "intensityMinutes", mod + vig)
                # Split so the app can chart moderate vs vigorous distribution.
                put(ds, "moderateIntensityMinutes", mod)
                put(ds, "vigorousIntensityMinutes", vig)
            dist = st.get("totalDistanceMeters")
            if isinstance(dist, (int, float)) and dist > 0:
                put(ds, "distanceKm", dist / 1000.0)

        # Detailed stress (average already comes from get_stats above).
        stress = call("get_stress_data", ds) or {}
        if isinstance(stress, dict):
            put(ds, "maxStress", stress.get("maxStressLevel"))

        # Body Battery high/low and charged/drained deltas for the day.
        bb = call("get_body_battery", ds, ds)
        bb_day = bb[0] if isinstance(bb, list) and bb else (bb if isinstance(bb, dict) else {})
        if isinstance(bb_day, dict):
            put(ds, "bodyBatteryHigh", _first_num(bb_day, "highestBatteryLevel", "charged"))
            put(ds, "bodyBatteryLow", _first_num(bb_day, "lowestBatteryLevel"))
            put(ds, "bodyBatteryCharged", _first_num(bb_day, "charged"))
            put(ds, "bodyBatteryDrained", _first_num(bb_day, "drained"))

        sl = call("get_sleep_data", ds) or {}
        dto = sl.get("dailySleepDTO") if isinstance(sl, dict) else None
        if isinstance(dto, dict):
            if dto.get("sleepTimeSeconds"):
                put(ds, "sleepMinutes", dto["sleepTimeSeconds"] / 60.0)
            if dto.get("deepSleepSeconds"):
                put(ds, "deepSleepMinutes", dto["deepSleepSeconds"] / 60.0)
            if dto.get("remSleepSeconds"):
                put(ds, "remSleepMinutes", dto["remSleepSeconds"] / 60.0)
            if dto.get("lightSleepSeconds"):
                put(ds, "lightSleepMinutes", dto["lightSleepSeconds"] / 60.0)
            if dto.get("awakeSleepSeconds"):
                put(ds, "awakeMinutes", dto["awakeSleepSeconds"] / 60.0)
            put(ds, "sleepScore", ((dto.get("sleepScores") or {}).get("overall") or {}).get("value"))

        hrv = call("get_hrv_data", ds) or {}
        if isinstance(hrv, dict):
            put(ds, "hrv", (hrv.get("hrvSummary") or {}).get("lastNightAvg"))

        sp = call("get_spo2_data", ds) or {}
        if isinstance(sp, dict):
            put(ds, "spo2", sp.get("averageSpO2") or sp.get("averageSpo2"))
            put(ds, "spo2Low", sp.get("lowestSpO2") or sp.get("lowestSpo2"))

        rp = call("get_respiration_data", ds) or {}
        if isinstance(rp, dict):
            put(ds, "respiration", rp.get("avgWakingRespirationValue") or rp.get("avgSleepRespirationValue"))
            put(ds, "respirationMin", rp.get("lowestRespirationValue"))
            put(ds, "respirationMax", rp.get("highestRespirationValue"))

        mx = call("get_max_metrics", ds)
        item = mx[0] if isinstance(mx, list) and mx else (mx if isinstance(mx, dict) else {})
        gen = (item.get("generic") or {}) if isinstance(item, dict) else {}
        put(ds, "vo2max", gen.get("vo2MaxValue"))
        cyc = (item.get("cycling") or {}) if isinstance(item, dict) else {}
        put(ds, "vo2maxCycling", cyc.get("vo2MaxValue"))

        # Training readiness is a genuinely daily score (0–100).
        tr = call("get_training_readiness", ds)
        tr_day = tr[0] if isinstance(tr, list) and tr else (tr if isinstance(tr, dict) else {})
        if isinstance(tr_day, dict):
            put(ds, "trainingReadiness", tr_day.get("score"))

        # Performance metrics that barely move day-to-day — pull weekly (and on the
        # most recent day) to keep the API-call count sane on multi-month syncs.
        if i % 7 == 0 or i == 0:
            fetch_slow_metrics(call, ds, put)

        # Be polite on long pulls so we don't trip Garmin's throttle, and show
        # progress so a multi-month run doesn't look frozen.
        time.sleep(0.2)
        if (i + 1) % 30 == 0 or (i + 1) == total:
            print(f"  ...pulled {i + 1}/{total} days of metrics", file=sys.stderr)

    return [{"date": d, "metrics": m} for d, m in by_date.items()]


def self_test():
    canned_weights = [
        {"date": "2026-06-01", "weightKg": 82.4, "bodyFatPct": 21.5},
        {"date": "2026-06-15", "weightKg": 81.9},
        {"date": "2026-07-01", "weightKg": 81.2, "bodyFatPct": 20.8},
    ]
    canned_sessions = [
        {"name": "Running", "date": "2026-06-20", "durationMin": 32.5, "kcal": 320, "trainingLoad": 88.0,
         "distanceKm": 5.2},
        {"name": "Strength Training", "date": "2026-06-25", "durationMin": 48.0, "kcal": 410},
    ]
    canned_health = [
        {"date": "2026-07-01", "metrics": {"steps": 8421, "restingHr": 54, "sleepMinutes": 447,
                                            "sleepScore": 82, "stress": 31, "bodyBattery": 76,
                                            "vo2max": 48.0, "hrv": 62, "spo2": 96, "intense": True,
                                            "trainingReadiness": 74, "enduranceScore": 6100,
                                            "hillScore": 58, "fitnessAge": 34.0, "raceTime5k": 1350,
                                            "bmi": 23.4, "muscleMassKg": 61.2, "lightSleepMinutes": 210,
                                            "bodyBatteryHigh": 92}},
        {"date": "bad-date", "metrics": {"steps": 100}},   # rejected
        {"date": "2026-07-02", "metrics": {"nope": "x"}},  # no numeric metrics -> rejected
    ]

    payload = build_payload(canned_weights, canned_sessions, canned_health)

    m0 = payload["health"][0]["metrics"] if payload["health"] else {}
    checks = [
        payload.get("version") == 1,
        len(payload["weights"]) == 3,
        len(payload["sessions"]) == 2,
        len(payload["health"]) == 1,
        m0.get("steps") == 8421,
        "intense" not in m0,  # bool excluded
        m0.get("vo2max") == 48.0,
        m0.get("trainingReadiness") == 74,
        m0.get("enduranceScore") == 6100,
        m0.get("hillScore") == 58,
        m0.get("fitnessAge") == 34.0,
        m0.get("raceTime5k") == 1350,
        m0.get("bmi") == 23.4,
        m0.get("lightSleepMinutes") == 210,
        m0.get("bodyBatteryHigh") == 92,
        # Defensive extractor helpers.
        _first_num({"a": True, "b": 5}, "a", "b") == 5,  # bool skipped
        _deep_num({"x": {"y": {"acuteTrainingLoad": 812}}}, "acuteTrainingLoad") == 812,
        _deep_num([{"z": 1}, {"score": 58}], "score") == 58,
        _deep_num({"nothing": 1}, "score") is None,
        all(DATE_RE.match(w["date"]) for w in payload["weights"]),
        all(isinstance(w["weightKg"], (int, float)) and w["weightKg"] > 0 for w in payload["weights"]),
        all(DATE_RE.match(s["date"]) for s in payload["sessions"]),
        all(isinstance(s["name"], str) and s["name"] for s in payload["sessions"]),
        payload["weights"][0].get("bodyFatPct") == 21.5,
        payload["sessions"][0].get("durationMin") == 32.5,
        payload["sessions"][0].get("trainingLoad") == 88.0,
        payload["sessions"][0].get("distanceKm") == 5.2,
        "trainingLoad" not in payload["sessions"][1],  # absent when not provided
        "distanceKm" not in payload["sessions"][1],  # absent when not provided
    ]

    # JSON round-trip sanity check.
    try:
        json.loads(json.dumps(payload))
        checks.append(True)
    except Exception:
        checks.append(False)

    passed = all(checks)
    print("PASS" if passed else "FAIL")
    return 0 if passed else 1


def main():
    parser = argparse.ArgumentParser(description="Sync Garmin Connect weigh-ins and activities to a FitMerge JSON import file.")
    parser.add_argument("--days", type=int, default=90, help="How many days back to pull (default 90)")
    parser.add_argument("--out", type=str, default="fitmerge-import.json", help="Output file path")
    parser.add_argument("--self-test", action="store_true", help="Run offline validation and exit (no network)")
    args = parser.parse_args()

    if args.self_test:
        sys.exit(self_test())

    weights, sessions, health = fetch_from_garmin(args.days)
    payload = build_payload(weights, sessions, health)

    with open(args.out, "w") as f:
        json.dump(payload, f, indent=2)

    print(
        f"Wrote {len(payload['weights'])} weigh-ins, {len(payload['sessions'])} sessions, "
        f"and {len(payload['health'])} days of metrics to {args.out}"
    )


if __name__ == "__main__":
    main()

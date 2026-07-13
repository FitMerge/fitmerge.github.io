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
      "sessions": [{"name": string, "date": "YYYY-MM-DD", "durationMin"?: number, "kcal"?: number}],
      "health":  [{"date": "YYYY-MM-DD", "metrics": {"steps": number, "restingHr": number,
                    "sleepMinutes": number, "sleepScore": number, "stress": number,
                    "bodyBattery": number, "hrv": number, "spo2": number, "vo2max": number, ...}}]
    }

The "metrics" bag is open-ended: any numeric field is imported and displayed, so new Garmin
metrics need no code change on either side.
"""

import argparse
import getpass
import json
import os
import re
import sys
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

    for entry in (body_comp or {}).get("dateWeightList", []) if isinstance(body_comp, dict) else (body_comp or []):
        calendar_date = entry.get("calendarDate") or entry.get("date")
        weight_grams = entry.get("weight")
        if calendar_date is None or weight_grams is None:
            continue
        row = {"date": str(calendar_date)[:10], "weightKg": weight_grams / 1000.0}
        body_fat = entry.get("bodyFat")
        if body_fat:
            row["bodyFatPct"] = body_fat
        weights.append(row)

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
        sessions.append(row)

    health = fetch_daily_metrics(client, end, days)
    return weights, sessions, health


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
        try:
            return m(*a)
        except Exception:
            return None

    for i in range(days + 1):
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
            dist = st.get("totalDistanceMeters")
            if isinstance(dist, (int, float)) and dist > 0:
                put(ds, "distanceKm", dist / 1000.0)

        sl = call("get_sleep_data", ds) or {}
        dto = sl.get("dailySleepDTO") if isinstance(sl, dict) else None
        if isinstance(dto, dict):
            if dto.get("sleepTimeSeconds"):
                put(ds, "sleepMinutes", dto["sleepTimeSeconds"] / 60.0)
            if dto.get("deepSleepSeconds"):
                put(ds, "deepSleepMinutes", dto["deepSleepSeconds"] / 60.0)
            if dto.get("remSleepSeconds"):
                put(ds, "remSleepMinutes", dto["remSleepSeconds"] / 60.0)
            put(ds, "sleepScore", ((dto.get("sleepScores") or {}).get("overall") or {}).get("value"))

        hrv = call("get_hrv_data", ds) or {}
        if isinstance(hrv, dict):
            put(ds, "hrv", (hrv.get("hrvSummary") or {}).get("lastNightAvg"))

        sp = call("get_spo2_data", ds) or {}
        if isinstance(sp, dict):
            put(ds, "spo2", sp.get("averageSpO2") or sp.get("averageSpo2"))

        rp = call("get_respiration_data", ds) or {}
        if isinstance(rp, dict):
            put(ds, "respiration", rp.get("avgWakingRespirationValue") or rp.get("avgSleepRespirationValue"))

        mx = call("get_max_metrics", ds)
        item = mx[0] if isinstance(mx, list) and mx else (mx if isinstance(mx, dict) else {})
        gen = (item.get("generic") or {}) if isinstance(item, dict) else {}
        put(ds, "vo2max", gen.get("vo2MaxValue"))

    return [{"date": d, "metrics": m} for d, m in by_date.items()]


def self_test():
    canned_weights = [
        {"date": "2026-06-01", "weightKg": 82.4, "bodyFatPct": 21.5},
        {"date": "2026-06-15", "weightKg": 81.9},
        {"date": "2026-07-01", "weightKg": 81.2, "bodyFatPct": 20.8},
    ]
    canned_sessions = [
        {"name": "Running", "date": "2026-06-20", "durationMin": 32.5, "kcal": 320},
        {"name": "Strength Training", "date": "2026-06-25", "durationMin": 48.0, "kcal": 410},
    ]
    canned_health = [
        {"date": "2026-07-01", "metrics": {"steps": 8421, "restingHr": 54, "sleepMinutes": 447,
                                            "sleepScore": 82, "stress": 31, "bodyBattery": 76,
                                            "vo2max": 48.0, "hrv": 62, "spo2": 96, "intense": True}},
        {"date": "bad-date", "metrics": {"steps": 100}},   # rejected
        {"date": "2026-07-02", "metrics": {"nope": "x"}},  # no numeric metrics -> rejected
    ]

    payload = build_payload(canned_weights, canned_sessions, canned_health)

    checks = [
        payload.get("version") == 1,
        len(payload["weights"]) == 3,
        len(payload["sessions"]) == 2,
        len(payload["health"]) == 1,
        payload["health"][0]["metrics"].get("steps") == 8421,
        "intense" not in payload["health"][0]["metrics"],  # bool excluded
        payload["health"][0]["metrics"].get("vo2max") == 48.0,
        all(DATE_RE.match(w["date"]) for w in payload["weights"]),
        all(isinstance(w["weightKg"], (int, float)) and w["weightKg"] > 0 for w in payload["weights"]),
        all(DATE_RE.match(s["date"]) for s in payload["sessions"]),
        all(isinstance(s["name"], str) and s["name"] for s in payload["sessions"]),
        payload["weights"][0].get("bodyFatPct") == 21.5,
        payload["sessions"][0].get("durationMin") == 32.5,
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

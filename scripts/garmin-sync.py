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
      "sessions": [{"name": string, "date": "YYYY-MM-DD", "durationMin"?: number, "kcal"?: number}]
    }
"""

import argparse
import getpass
import json
import os
import re
import sys
from datetime import date, timedelta

DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def build_payload(weights, sessions):
    """Assembles + validates the version-1 FitMerge JSON payload from already-shaped rows."""
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

    return {"version": 1, "weights": clean_weights, "sessions": clean_sessions}


def fetch_from_garmin(days):
    try:
        from garminconnect import Garmin
    except ImportError:
        print("error: the garminconnect package is required — run: pip install garminconnect", file=sys.stderr)
        sys.exit(1)

    email = os.environ.get("GARMIN_EMAIL") or input("Garmin email: ")
    password = os.environ.get("GARMIN_PASSWORD") or getpass.getpass("Garmin password: ")

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

    return weights, sessions


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

    payload = build_payload(canned_weights, canned_sessions)

    checks = [
        payload.get("version") == 1,
        len(payload["weights"]) == 3,
        len(payload["sessions"]) == 2,
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

    weights, sessions = fetch_from_garmin(args.days)
    payload = build_payload(weights, sessions)

    with open(args.out, "w") as f:
        json.dump(payload, f, indent=2)

    print(f"Wrote {len(payload['weights'])} weigh-ins and {len(payload['sessions'])} sessions to {args.out}")


if __name__ == "__main__":
    main()

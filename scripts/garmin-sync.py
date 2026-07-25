#!/usr/bin/env python3
"""garmin-sync.py — pull recent weigh-ins and activities from Garmin Connect and either write a
FitMerge health-import JSON file (version 1) OR push straight into your FitMerge account so the
app updates itself with no manual import.

Two modes:

  1) File mode (default) — writes a JSON file you import from Settings -> "Connect health data":
         pip install garminconnect
         python3 scripts/garmin-sync.py --days 90 --out fitmerge-import.json

  2) Auto-sync mode (--firebase) — writes directly to your FitMerge cloud data. The app picks it
     up automatically on every device via the existing realtime sync — no file, no import step:
         pip install garminconnect firebase-admin
         python3 scripts/garmin-sync.py --days 90 --firebase \
             --service-account serviceAccount.json --uid YOUR_FITMERGE_UID

     - serviceAccount.json comes from the Firebase console: Project settings -> Service accounts
       -> "Generate new private key". Keep it private; it never leaves your machine.
     - YOUR_FITMERGE_UID is shown in FitMerge under Settings -> Sync (once signed in with Google),
       and in the Firebase console under Authentication -> Users.
     - Both can also be supplied via the FIREBASE_SERVICE_ACCOUNT / FIREBASE_UID env vars.
     - The push is READ-MERGE-WRITE: your existing cloud data (app-created workouts, weigh-ins,
       other days of metrics) is preserved; Garmin data is folded in and re-runs are idempotent
       (no duplicate activities). Schedule it nightly with cron / Windows Task Scheduler.

Credentials come from the GARMIN_EMAIL / GARMIN_PASSWORD environment variables, or you'll be
prompted for them. Session tokens are cached by the underlying `garth` library at
~/.garminconnect so you won't be re-prompted every run.

Run `python3 scripts/garmin-sync.py --self-test` to validate the JSON-building and cloud-merge
logic offline (no network, no garminconnect/firebase dependency needed) — this is what CI runs.

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
import base64
import getpass
import json
import os
import re
import secrets
import sys
import time
from datetime import date, datetime, timedelta, timezone

DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

# Identifies writes made by this script so they're distinguishable from the app's own
# writes in the sync log. The app only ignores echoes of ITS OWN per-tab client id, so a
# distinct id here means every device applies the script's writes via its realtime listener.
SYNC_CLIENT_ID = "garmin-sync-script"


def build_payload(weights, sessions, health=None, records=None):
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

    return {
        "version": 1,
        "weights": clean_weights,
        "sessions": clean_sessions,
        "health": clean_health,
        "records": map_personal_records(records or []),
    }


# --- auto-sync (direct Firestore push) -------------------------------------
# These merge helpers mirror the app's per-store cloud shapes exactly (see
# src/services/sync/storeAdapters.ts). They are PURE so the self-test can exercise
# them offline. The app HARD-REPLACES the body and workouts stores when it receives
# a cloud update, so the script must write the FULL merged set — never just the new
# rows — or it would wipe app-created data. Health days are unioned by the app, but we
# merge them here too so the write is self-consistent and re-runs stay idempotent.


def _js_num_str(v):
    """Format a number the way JS String()/JSON does — integers lose the trailing '.0'.
    The app's imported-session dedupe key is built in JS, so matching its formatting is
    what keeps re-runs from creating duplicate activities."""
    if v is None:
        return ""
    f = float(v)
    return str(int(f)) if f == int(f) else repr(f)


def _session_key(s):
    """Dedupe key for an imported session — must match the app's
    `${date}::${name}::${durationMin ?? ''}::${kcal ?? ''}` (workouts store)."""
    return "::".join([
        str(s.get("date")),
        str(s.get("name")),
        _js_num_str(s.get("durationMin")),
        _js_num_str(s.get("kcal")),
    ])


def _epoch_noon_ms(ds):
    """Milliseconds since epoch at noon UTC on the given YYYY-MM-DD — a stable stand-in
    for the app's `Date.parse(`${date}T12:00:00`)` used only for sorting/display."""
    y, m, d = (int(x) for x in ds.split("-"))
    return int(datetime(y, m, d, 12, 0, 0, tzinfo=timezone.utc).timestamp() * 1000)


def merge_body(existing, weights):
    """Upsert Garmin weigh-ins into the body store by date (Garmin wins the weight fields,
    any existing note on that date is preserved); untouched dates and measurements stay."""
    ex = existing if isinstance(existing, dict) else {}
    measurements = ex.get("measurements") if isinstance(ex.get("measurements"), list) else []
    by_date = {}
    for e in ex.get("entries") or []:
        if isinstance(e, dict) and isinstance(e.get("date"), str):
            by_date[e["date"]] = dict(e)
    for w in weights:
        by_date[w["date"]] = {**by_date.get(w["date"], {}), **w}
    entries = [by_date[d] for d in sorted(by_date)]
    return {"entries": entries, "measurements": measurements}


#: Fields carried from a Garmin activity onto its stored session. Also the fields
#: backfilled onto sessions already saved — see merge_workouts.
_IMPORT_FIELDS = ("durationMin", "kcal", "trainingLoad", "distanceKm")

#: Garmin's personal-record types, keyed by its typeId. Garmin computes these across
#: whole activities *and* segments within them, so the 5K here is the fastest 5K you
#: have ever run — including one buried inside a 10K, which is not something this
#: import could work out for itself from a single distance and duration per session.
#:
#: The API leaves prTypeLabelKey null, so the ids are mapped explicitly. Only the
#: ones confirmed against real data are listed: the running times come back
#: monotonically slower as the distance grows, which is the physiological sanity
#: check that pins the mapping down. Unknown ids are ignored rather than guessed at.
_PR_TYPES = {
    1: ("Fastest 1 km", "time"),
    2: ("Fastest 1 mile", "time"),
    3: ("Fastest 5K", "time"),
    4: ("Fastest 10K", "time"),
    5: ("Fastest half marathon", "time"),
    6: ("Fastest marathon", "time"),
    7: ("Longest run", "distance"),
    8: ("Longest ride", "distance"),
}


def _pr_date(record):
    """First usable YYYY-MM-DD among the several date fields Garmin may populate."""
    for key in ("prStartTimeGmtFormatted", "activityStartDateTimeLocalFormatted",
                "actStartDateTimeInGMTFormatted", "prStartTimeLocalFormatted"):
        value = record.get(key)
        if isinstance(value, str) and DATE_RE.match(value[:10]):
            return value[:10]
    return None


def map_personal_records(raw):
    """Shape Garmin's personal-record list into the app's records.

    Pure so it can be exercised offline; `raw` is whatever get_personal_record()
    returned. Times are seconds, distances metres — the units Garmin reports.
    """
    if isinstance(raw, dict):
        raw = raw.get("personalRecords") or []
    if not isinstance(raw, list):
        return []

    out = []
    for record in raw:
        if not isinstance(record, dict):
            continue
        mapped = _PR_TYPES.get(record.get("typeId"))
        if mapped is None:
            continue
        label, kind = mapped
        value = record.get("value")
        if not isinstance(value, (int, float)) or isinstance(value, bool) or value <= 0:
            continue
        row = {
            "typeId": record.get("typeId"),
            "label": label,
            "kind": kind,
            "value": round(float(value), 3),
        }
        date = _pr_date(record)
        if date:
            row["date"] = date
        activity_id = record.get("activityId")
        if isinstance(activity_id, (int, str)) and activity_id:
            row["activityId"] = str(activity_id)
        out.append(row)

    out.sort(key=lambda r: r["typeId"])
    return out


def merge_workouts(existing, sessions, records=None):
    """Append Garmin activities as imported sessions and backfill missing fields onto
    ones already stored. Routines/programs and app-logged sessions are left untouched.
    Returns (merged_store, added_count, updated_count).

    Backfill matters because this import used to be strictly add-only: a session whose
    key already existed was skipped outright. Fields added to the importer later —
    distanceKm especially — therefore never reached activities imported before that,
    and no amount of re-running would fix them. That is what left older runs with no
    pace or distance charts.

    The dedupe key is date+name+duration+kcal, so a matching session can only really
    differ in trainingLoad/distanceKm. Only absent values are filled, never
    overwritten, so a re-import can add what is missing but cannot rewrite history.
    """
    ex = existing if isinstance(existing, dict) else {}
    routines = ex.get("routines") if isinstance(ex.get("routines"), list) else []
    programs = ex.get("programs") if isinstance(ex.get("programs"), list) else []
    existing_sessions = ex.get("sessions") if isinstance(ex.get("sessions"), list) else []

    # Copy up front so backfill mutates the rows we are about to return, never the
    # caller's objects.
    merged = []
    by_key = {}
    for s in existing_sessions:
        if isinstance(s, dict):
            row = dict(s)
            merged.append(row)
            if row.get("imported"):
                by_key.setdefault(_session_key(row), row)
        else:
            merged.append(s)

    added = 0
    updated = 0
    for s in sessions:
        key = _session_key(s)
        target = by_key.get(key)
        if target is not None:
            changed = False
            for k in _IMPORT_FIELDS:
                if k in s and target.get(k) is None:
                    target[k] = s[k]
                    changed = True
            if changed:
                updated += 1
            continue

        started = _epoch_noon_ms(s["date"])
        row = {
            "id": secrets.token_hex(8),
            "name": s["name"],
            "date": s["date"],
            "startedAt": started,
            "finishedAt": started + int(round((s.get("durationMin") or 0) * 60000)),
            "entries": [],
            "imported": True,
        }
        for k in _IMPORT_FIELDS:
            if k in s:
                row[k] = s[k]
        merged.append(row)
        by_key[key] = row
        added += 1

    # Personal records are replaced wholesale rather than merged: Garmin recomputes
    # the whole set, so its list is the truth. Absent (no records fetched this run)
    # means leave whatever is stored alone.
    out = {"routines": routines, "sessions": merged, "programs": programs}
    kept = ex.get("garminRecords")
    if records:
        out["garminRecords"] = records
    elif isinstance(kept, list):
        out["garminRecords"] = kept

    return out, added, updated


def merge_health(existing, health):
    """Union health days into the store, merging metric bags per date (Garmin wins a
    per-metric conflict since it's the source of truth for wearable data)."""
    ex = existing if isinstance(existing, dict) else {}
    out = {}
    for d, day in (ex.get("days") or {}).items():
        if isinstance(day, dict) and isinstance(day.get("metrics"), dict):
            out[d] = {"date": d, "metrics": dict(day["metrics"])}
    for h in health:
        d = h["date"]
        cur = out.get(d, {"date": d, "metrics": {}})
        cur["metrics"] = {**cur["metrics"], **h["metrics"]}
        out[d] = cur
    return {"days": out}


def init_firebase(service_account):
    """Initialise firebase-admin once and hand back a Firestore client."""
    try:
        import firebase_admin
        from firebase_admin import credentials, firestore
    except ImportError:
        print("error: the firebase-admin package is required for --firebase — run: "
              "pip install firebase-admin", file=sys.stderr)
        sys.exit(1)

    if not os.path.exists(service_account):
        print(f"error: service-account file not found: {service_account}", file=sys.stderr)
        sys.exit(1)

    if not firebase_admin._apps:
        firebase_admin.initialize_app(credentials.Certificate(service_account))
    return firestore.client()


def push_to_firebase(payload, service_account, uid):
    """Read-merge-write the payload into users/{uid}/state/{body,workouts,health}."""
    return push_payload(init_firebase(service_account), uid, payload)


def push_payload(db, uid, payload):
    """The actual merge+write, against an existing Firestore client. Split out so
    the multi-user runner can reuse one connection across everybody."""
    from firebase_admin import firestore

    def ref(store):
        return db.collection("users").document(uid).collection("state").document(store)

    # Raw stored JSON per store, so an unchanged run can skip the write entirely.
    previous = {}

    def read(store):
        snap = ref(store).get()
        if not getattr(snap, "exists", False):
            return None
        data = snap.to_dict() or {}
        p = data.get("payload")
        if isinstance(p, str):
            previous[store] = p
            try:
                return json.loads(p)
            except json.JSONDecodeError:
                return None
        return p if isinstance(p, dict) else None

    def write(store, obj):
        """Write only when something actually changed.

        Most scheduled runs find nothing new. Rewriting the document anyway would
        push a full copy of it — the health store grows to hundreds of KB — down
        to every signed-in device on every run, which is the dominant bandwidth
        cost once more than one person is syncing."""
        encoded = json.dumps(obj, separators=(",", ":"))
        if previous.get(store) == encoded:
            return False
        ref(store).set({
            "payload": encoded,
            "clientId": SYNC_CLIENT_ID,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        })
        return True

    body = merge_body(read("body"), payload["weights"])
    write("body", body)

    workouts, added, backfilled = merge_workouts(
        read("workouts"), payload["sessions"], payload.get("records")
    )
    write("workouts", workouts)
    if backfilled:
        print(f"Backfilled missing fields on {backfilled} already-imported session(s).",
              file=sys.stderr)

    health = merge_health(read("health"), payload["health"])
    write("health", health)

    return len(body["entries"]), added, len(health["days"])


def _tokenstore_path():
    return os.path.expanduser(os.environ.get("GARMINTOKENS", "~/.garminconnect"))


def export_tokens():
    """Print the cached Garmin session as one base64 line, for use as a CI secret.

    Run this locally AFTER a normal sync has logged you in (so ~/.garminconnect
    exists). Paste the output into a GitHub Actions secret named GARMIN_TOKENS_B64;
    the cloud job restores it and logs in with no email/password/2-factor prompt."""
    tokenstore = _tokenstore_path()
    if not (os.path.isdir(tokenstore) and os.listdir(tokenstore)):
        print(f"error: no cached Garmin session at {tokenstore}. Run a normal sync first "
              "to log in, then re-run --export-tokens.", file=sys.stderr)
        return 1
    blob = {}
    for name in sorted(os.listdir(tokenstore)):
        p = os.path.join(tokenstore, name)
        if os.path.isfile(p):
            with open(p, "r", encoding="utf-8") as f:
                blob[name] = f.read()
    encoded = base64.b64encode(json.dumps(blob).encode("utf-8")).decode("ascii")
    print(encoded)
    return 0


def _restore_tokens_from_env():
    """If GARMIN_TOKENS_B64 is set (the CI path) and no local token store exists yet,
    materialise the cached session into the token store so login() can resume it with
    no interactive 2-factor prompt."""
    encoded = os.environ.get("GARMIN_TOKENS_B64")
    if not encoded:
        return
    tokenstore = _tokenstore_path()
    if os.path.isdir(tokenstore) and os.listdir(tokenstore):
        return  # a real session is already present; don't clobber it
    try:
        blob = json.loads(base64.b64decode(encoded).decode("utf-8"))
    except Exception as e:
        print(f"warning: GARMIN_TOKENS_B64 could not be decoded ({e}); ignoring it.", file=sys.stderr)
        return
    os.makedirs(tokenstore, exist_ok=True)
    for name, content in blob.items():
        if isinstance(name, str) and isinstance(content, str) and "/" not in name and "\\" not in name:
            with open(os.path.join(tokenstore, name), "w", encoding="utf-8") as f:
                f.write(content)
    print("Restored Garmin session from GARMIN_TOKENS_B64.", file=sys.stderr)


def _garmin_login():
    """Return a logged-in Garmin client, reusing a cached session when possible.

    The session is saved to a token store (GARMINTOKENS env var, else ~/.garminconnect)
    after the first successful login, so every later run — including the scheduled job —
    resumes silently with NO email/password/2-factor prompt. Credentials are only asked
    for on the very first run, or after the token expires (roughly yearly)."""
    _restore_tokens_from_env()
    try:
        from garminconnect import Garmin
    except ImportError:
        print("error: the garminconnect package is required — run: pip install garminconnect", file=sys.stderr)
        sys.exit(1)

    tokenstore = os.path.expanduser(os.environ.get("GARMINTOKENS", "~/.garminconnect"))
    have_tokens = os.path.isdir(tokenstore) and bool(os.listdir(tokenstore))

    def prompt_mfa():
        # Called only when the account has two-factor enabled. Garmin sends a code
        # (email or authenticator app); we read it from the terminal.
        return input("Garmin 2-factor code (check your email / authenticator app): ").strip()

    # 1) Resume from a saved session — no prompt, no password. garminconnect's own
    #    login(tokenstore) loads the token store with the SAME client it makes API
    #    calls with (self.client). When no valid token exists it raises
    #    "Username and password are required", which we catch and fall through.
    if have_tokens:
        try:
            client = Garmin()
            client.login(tokenstore)
            print("Resumed saved Garmin session — no login needed", file=sys.stderr)
            return client
        except TypeError:
            pass  # very old garminconnect without a tokenstore arg → full login below
        except Exception as e:
            print(f"(saved session couldn't be reused: {e}) — logging in fresh", file=sys.stderr)

    # 2) Full login. Pass the token store to login() so garminconnect persists the
    #    session with ITS OWN client (self.client.dump). Saving via the module-level
    #    garth.client was the earlier bug — that's a different, un-logged-in client,
    #    so it wrote junk token files that could never be resumed.
    email = os.environ.get("GARMIN_EMAIL") or input("Garmin email: ")
    password = os.environ.get("GARMIN_PASSWORD") or getpass.getpass("Garmin password: ")

    try:
        client = Garmin(email=email, password=password, prompt_mfa=prompt_mfa)
    except TypeError:
        client = Garmin(email, password)

    try:
        client.login(tokenstore)  # auto-dumps the session to tokenstore on fresh login
    except TypeError:
        client.login()  # very old versions: no tokenstore arg

    # Belt-and-suspenders: if login didn't persist the session, dump it explicitly
    # using the instance's OWN garth client (client.client), not the module singleton.
    if not (os.path.isdir(tokenstore) and os.listdir(tokenstore)):
        try:
            os.makedirs(tokenstore, exist_ok=True)
        except Exception:
            pass
        for saver in (
            lambda: client.client.dump(tokenstore),             # 0.3.x: per-instance garth Client
            lambda: getattr(client, "garth").dump(tokenstore),  # other builds expose .garth
        ):
            try:
                saver()
            except Exception:
                continue
            if os.path.isdir(tokenstore) and os.listdir(tokenstore):
                break

    if os.path.isdir(tokenstore) and os.listdir(tokenstore):
        print(f"Saved Garmin session to {tokenstore} — future runs won't prompt.", file=sys.stderr)
    else:
        print("warning: the login token was NOT saved; you may be prompted again next run.", file=sys.stderr)

    return client


def fetch_from_garmin(days, client=None):
    # `client` lets the multi-user runner supply an already-logged-in session for
    # a specific person; left as None this logs in the usual single-user way.
    if client is None:
        client = _garmin_login()

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

    # Personal records are all-time and cheap (one call), so they come back on every
    # run regardless of the --days window. Garmin computes them across segments
    # within activities, which is the only way to know the fastest 5K inside a 10K.
    records = []
    get_prs = getattr(client, "get_personal_record", None)
    if get_prs is not None:
        try:
            records = get_prs() or []
        except Exception as exc:  # noqa: BLE001 - never fail a sync over a bonus metric
            print(f"warning: could not fetch personal records ({exc})", file=sys.stderr)

    return weights, sessions, health, records


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

    # Shaped like a real get_personal_record() response, including the ids this
    # importer deliberately ignores rather than guesses at.
    canned_records = [
        {"typeId": 3, "value": 1355.02, "activityId": 111,
         "prStartTimeGmtFormatted": "2024-05-01T23:51:11.0"},
        {"typeId": 7, "value": 74701.45, "activityId": 222,
         "prStartTimeGmtFormatted": "2024-10-04T10:12:31.0"},
        {"typeId": 12, "value": 79992.0},   # most steps in a day — not a workout PR
        {"typeId": 4, "value": 0},          # zero value, dropped
        {"typeId": 4, "value": True},       # bool masquerading as a number, dropped
        "not-a-record",
    ]

    payload = build_payload(canned_weights, canned_sessions, canned_health, canned_records)

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
        # Personal records: only the confirmed ids survive, sorted by type.
        [r["typeId"] for r in payload["records"]] == [3, 7],
        payload["records"][0]["label"] == "Fastest 5K",
        payload["records"][0]["kind"] == "time",
        payload["records"][0]["value"] == 1355.02,
        payload["records"][0]["date"] == "2024-05-01",
        payload["records"][0]["activityId"] == "111",
        payload["records"][1]["label"] == "Longest run",
        payload["records"][1]["kind"] == "distance",
        # A dict response is unwrapped, and junk in is nothing out.
        map_personal_records({"personalRecords": [{"typeId": 3, "value": 1200.0}]})[0]["value"] == 1200.0,
        map_personal_records(None) == [],
        map_personal_records([]) == [],
    ]

    # JSON round-trip sanity check.
    try:
        json.loads(json.dumps(payload))
        checks.append(True)
    except Exception:
        checks.append(False)

    # --- auto-sync merge helpers (pure, offline) ---------------------------
    # JS-style number formatting for dedupe keys: integers drop the ".0".
    checks += [
        _js_num_str(48.0) == "48",
        _js_num_str(32.5) == "32.5",
        _js_num_str(None) == "",
        _js_num_str(320) == "320",
    ]

    # body: Garmin weight upserts by date, existing note + other dates preserved.
    existing_body = {
        "entries": [
            {"date": "2026-06-01", "weightKg": 99.9, "note": "manual"},
            {"date": "2026-05-01", "weightKg": 83.0},
        ],
        "measurements": [{"date": "2026-06-01", "chest": 100}],
    }
    mb = merge_body(existing_body, payload["weights"])
    b_by_date = {e["date"]: e for e in mb["entries"]}
    checks += [
        len(mb["entries"]) == 4,  # 3 Garmin dates + the untouched 2026-05-01
        b_by_date["2026-06-01"]["weightKg"] == 82.4,  # Garmin overrode the weight
        b_by_date["2026-06-01"].get("note") == "manual",  # ...but kept the note
        b_by_date["2026-05-01"]["weightKg"] == 83.0,  # untouched date preserved
        mb["measurements"] == existing_body["measurements"],  # measurements untouched
        [e["date"] for e in mb["entries"]] == sorted(b_by_date),  # sorted by date
    ]

    # workouts: dedupe imported sessions; keep routines/programs + app-logged sessions.
    existing_workouts = {
        "routines": [{"id": "r1"}],
        "programs": [{"id": "p1"}],
        "sessions": [
            {"id": "app1", "name": "Bench", "date": "2026-06-25", "imported": False},
            # An already-imported Running matching one of the payload sessions.
            {"id": "imp1", "name": "Running", "date": "2026-06-20", "durationMin": 32.5,
             "kcal": 320, "imported": True},
        ],
    }
    mw, added, backfilled = merge_workouts(existing_workouts, payload["sessions"])
    imported_names = [s["name"] for s in mw["sessions"] if s.get("imported")]
    imp1 = next(s for s in mw["sessions"] if s.get("id") == "imp1")
    app1 = next(s for s in mw["sessions"] if s.get("id") == "app1")
    checks += [
        added == 1,  # Running is a dup; only Strength Training is new
        mw["routines"] == existing_workouts["routines"],
        mw["programs"] == existing_workouts["programs"],
        any(s["id"] == "app1" for s in mw["sessions"]),  # app session preserved
        imported_names.count("Running") == 1,  # not duplicated
        "Strength Training" in imported_names,
        all(s.get("entries") == [] for s in mw["sessions"] if s.get("imported") and s["id"] != "imp1"),
        # The dup is not skipped outright any more: fields it never had are filled in,
        # which is what unlocks pace/distance on activities imported before those
        # fields existed.
        backfilled == 1,
        imp1.get("distanceKm") == 5.2,
        imp1.get("trainingLoad") == 88.0,
        # Backfill must not invent fields on app-logged sessions.
        "distanceKm" not in app1,
        # The caller's objects are never mutated in place.
        "distanceKm" not in existing_workouts["sessions"][1],
    ]
    # Re-running against the already-merged store adds nothing and, now that the
    # gaps are filled, backfills nothing either (idempotent).
    _, added_again, backfilled_again = merge_workouts(mw, payload["sessions"])
    checks += [added_again == 0, backfilled_again == 0]

    # An existing value is never overwritten — Garmin may report a corrected distance,
    # but rewriting stored history silently is worse than leaving it alone.
    stale = {"sessions": [
        {"id": "imp2", "name": "Running", "date": "2026-06-20", "durationMin": 32.5,
         "kcal": 320, "distanceKm": 1.1, "imported": True},
    ]}
    ms, _, _ = merge_workouts(stale, payload["sessions"])
    checks.append(ms["sessions"][0]["distanceKm"] == 1.1)

    # Records replace wholesale (Garmin recomputes the set), but a run that fetched
    # none must not wipe the ones already stored.
    with_recs, _, _ = merge_workouts({"sessions": []}, [], payload["records"])
    kept, _, _ = merge_workouts(with_recs, [])
    replaced, _, _ = merge_workouts(with_recs, [], [{"typeId": 3, "label": "Fastest 5K",
                                                     "kind": "time", "value": 1300.0}])
    checks += [
        len(with_recs["garminRecords"]) == 2,
        len(kept["garminRecords"]) == 2,          # absent records leave storage alone
        len(replaced["garminRecords"]) == 1,      # a fetched set replaces, not appends
        replaced["garminRecords"][0]["value"] == 1300.0,
        "garminRecords" not in merge_workouts({"sessions": []}, [])[0],  # nothing invented
    ]

    # health: union days, merge metric bags per date (Garmin wins on conflict).
    existing_health = {"days": {
        "2026-07-01": {"date": "2026-07-01", "metrics": {"steps": 1, "customMetric": 5}},
        "2026-01-01": {"date": "2026-01-01", "metrics": {"steps": 100}},
    }}
    mh = merge_health(existing_health, payload["health"])
    checks += [
        len(mh["days"]) == 2,  # 2026-07-01 (merged) + untouched 2026-01-01
        mh["days"]["2026-07-01"]["metrics"]["steps"] == 8421,  # Garmin overrode
        mh["days"]["2026-07-01"]["metrics"]["customMetric"] == 5,  # kept existing extra
        mh["days"]["2026-01-01"]["metrics"]["steps"] == 100,  # untouched day preserved
    ]

    # Merge helpers tolerate an empty/absent cloud doc (first-ever sync).
    checks += [
        merge_body(None, payload["weights"])["entries"] and True,
        merge_workouts(None, payload["sessions"])[1] == 2,  # both sessions new
        merge_workouts(None, payload["sessions"])[2] == 0,  # nothing to backfill
        len(merge_health(None, payload["health"])["days"]) == 1,
    ]

    passed = all(checks)
    print("PASS" if passed else "FAIL")
    return 0 if passed else 1


def main():
    parser = argparse.ArgumentParser(description="Sync Garmin Connect weigh-ins and activities to FitMerge — as a JSON file or straight to your account.")
    parser.add_argument("--days", type=int, default=90, help="How many days back to pull (default 90)")
    parser.add_argument("--out", type=str, default="fitmerge-import.json", help="Output file path (file mode)")
    parser.add_argument("--firebase", action="store_true",
                        help="Push straight to your FitMerge account (auto-sync) instead of writing a file")
    parser.add_argument("--service-account", type=str, default=os.environ.get("FIREBASE_SERVICE_ACCOUNT"),
                        help="Path to your Firebase service-account JSON (auto-sync; or FIREBASE_SERVICE_ACCOUNT)")
    parser.add_argument("--uid", type=str, default=os.environ.get("FIREBASE_UID"),
                        help="Your FitMerge account user id, from Settings -> Sync (auto-sync; or FIREBASE_UID)")
    parser.add_argument("--all-users", action="store_true",
                        help="Sync every account that connected Garmin through the app (needs GARMIN_LINK_PRIVATE_KEY)")
    parser.add_argument("--link-worker", action="store_true",
                        help="Finish pending Garmin connections, including the live 2-factor handshake")
    parser.add_argument("--max-users", type=int, default=10,
                        help="Safety cap on how many accounts one run will process (default 10)")
    parser.add_argument("--self-test", action="store_true", help="Run offline validation and exit (no network)")
    parser.add_argument("--export-tokens", action="store_true",
                        help="Print the cached Garmin session as base64 for a GitHub Actions secret (GARMIN_TOKENS_B64)")
    args = parser.parse_args()

    if args.self_test:
        sys.exit(self_test())

    if args.export_tokens:
        sys.exit(export_tokens())

    # Multi-user modes: one job serving everyone who connected Garmin in the app.
    # These never touch the single-user path below, so an existing --uid setup
    # keeps working exactly as before.
    if args.all_users or args.link_worker:
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from garmin_multi import link_worker, load_private_key_from_env, sync_all_users

        if not args.service_account:
            print("error: --all-users/--link-worker need --service-account (or FIREBASE_SERVICE_ACCOUNT).",
                  file=sys.stderr)
            sys.exit(2)
        private_key = load_private_key_from_env()
        if private_key is None:
            print("error: set the GARMIN_LINK_PRIVATE_KEY secret (see scripts/garmin-keygen.py).",
                  file=sys.stderr)
            sys.exit(2)

        db = init_firebase(args.service_account)
        if args.link_worker:
            link_worker(db, private_key, max_users=max(1, min(args.max_users, 3)))
        else:
            # Skip the owner when they already sync through the single-user path,
            # so their data isn't pulled twice in the same run.
            sync_all_users(db, private_key, days=args.days, skip_uid=args.uid, max_users=args.max_users)
        return

    if args.firebase:
        if not args.service_account or not args.uid:
            print("error: --firebase requires --service-account and --uid (or the FIREBASE_SERVICE_ACCOUNT "
                  "/ FIREBASE_UID env vars). Your uid is shown in FitMerge under Settings -> Sync.",
                  file=sys.stderr)
            sys.exit(2)

    weights, sessions, health, records = fetch_from_garmin(args.days)
    payload = build_payload(weights, sessions, health, records)

    if args.firebase:
        n_weights, n_sessions, n_health = push_to_firebase(payload, args.service_account, args.uid)
        print(
            f"Auto-synced to your FitMerge account: {n_weights} weigh-ins and {n_health} days of "
            f"metrics in the cloud; added {n_sessions} new activit{'y' if n_sessions == 1 else 'ies'}. "
            "Open the app — it updates automatically."
        )
        return

    with open(args.out, "w") as f:
        json.dump(payload, f, indent=2)

    print(
        f"Wrote {len(payload['weights'])} weigh-ins, {len(payload['sessions'])} sessions, "
        f"and {len(payload['health'])} days of metrics to {args.out}"
    )


if __name__ == "__main__":
    main()

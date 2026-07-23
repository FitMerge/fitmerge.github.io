# Cloud pull — phone button + hourly, no PC needed

This runs the Garmin pull on GitHub's servers instead of your computer, so it works
even when your PC is off, and the app gets a **"Pull from Garmin"** button (Settings →
Pull from Garmin) plus an automatic hourly refresh. Data lands in your FitMerge cloud
and every device updates itself via sync.

**One-time setup**

1. **Log in to Garmin once, locally**, then export the saved session:
   ```
   pip install garminconnect firebase-admin
   python scripts/garmin-sync.py --days 7          # logs in (asks for 2FA once)
   python scripts/garmin-sync.py --export-tokens   # prints one base64 line
   ```
2. **Add three repository secrets** (GitHub repo → Settings → Secrets and variables →
   Actions → New repository secret):
   - `GARMIN_TOKENS_B64` — the base64 line from `--export-tokens`.
   - `FIREBASE_SERVICE_ACCOUNT` — the full contents of your `serviceAccount.json`.
   - `FIREBASE_UID` — your FitMerge id (app → Settings → Sync).
   - (Optional) `GARMIN_EMAIL` / `GARMIN_PASSWORD` as a fallback if the token expires.
3. **Make sure `.github/workflows/garmin-pull.yml` is on your repo's default branch**
   (merge it to `main`). Scheduled and dispatched runs only work from the default branch.
4. **Create a fine-grained token** (GitHub → Settings → Developer settings → Fine-grained
   tokens) limited to this one repo with **Actions: Read and write**. In the app →
   Settings → Pull from Garmin, paste your `owner/repo` and the token, and Save.

That's it. The hourly schedule runs on its own; the button triggers an immediate pull.
The token you paste into the app stays on that device only — it is never synced to the
cloud. If a scheduled run ever fails with a Garmin login error, re-run steps 1–2 to
refresh `GARMIN_TOKENS_B64` (the cached login lasts ~a year).

---

# Automating the Garmin pull (Windows PC — the original local method)

Once this is set up, your Garmin data flows into FitMerge on a schedule and every
device updates itself — no file, no manual import. Here's the whole path.

## Prerequisites (one-time)

1. **Firebase sync connected.** In the app, open **Settings → Sync** and make sure
   you're signed in with Google (it should say "Synced ✓"). Auto-sync writes into
   the same cloud account, so this has to be done first.

2. **Python installed.** Open a terminal and run `python --version`. If Windows
   says *"Python was not found"*, install it from <https://www.python.org/downloads/>
   and **tick "Add python.exe to PATH"** on the first screen of the installer.

3. **Install the two libraries** (one time):
   ```
   pip install garminconnect firebase-admin
   ```

## Get your two secrets

4. **Service-account key.** In the [Firebase console](https://console.firebase.google.com/):
   **Project settings → Service accounts → Generate new private key**. Save the file
   as `serviceAccount.json` inside the `scripts` folder (next to `run-garmin-sync.bat`).
   Keep it private — it never leaves your computer.

5. **Your account id (UID).** In the app: **Settings → Sync → "Automate Garmin import"**
   → tap the id to copy it. (Also visible in the Firebase console under
   **Authentication → Users**.)

## Configure and test

6. Open `scripts\run-garmin-sync.bat` in Notepad and paste your UID into the
   `FITMERGE_UID=` line. Save.

7. **Double-click `run-garmin-sync.bat`.** The first run will ask for your Garmin
   email/password (and a 2-factor code if your account uses one). That login is
   cached, so later runs won't prompt. Check the app afterward — your Garmin data
   should appear. A `garmin-sync.log` file next to the .bat records each run.

## Schedule it nightly (Task Scheduler)

8. Press **Start**, type **Task Scheduler**, open it.
9. **Create Basic Task…** → name it "FitMerge Garmin sync" → **Next**.
10. Trigger: **Daily** → pick a time (e.g. 6:00 AM) → **Next**.
11. Action: **Start a program** → **Browse…** → select `run-garmin-sync.bat` → **Next → Finish**.
12. (Recommended) Find the task in the list → **Properties** → General tab →
    **"Run whether user is logged on or not"**, and check **"Run task as soon as
    possible after a scheduled start is missed"** so it catches up if the PC was off.

That's it — it now runs every day on its own.

## Notes & caveats

- **Read-merge-write:** the script never clobbers your existing cloud data. It folds
  Garmin weigh-ins, activities, and daily health metrics in, and re-runs are
  idempotent (the same activity is never imported twice).
- **Login token expiry:** the cached Garmin login lasts roughly a year. If a scheduled
  run starts failing with a login error (check `garmin-sync.log`), just double-click
  the .bat once to re-authenticate, then the schedule resumes.
- **The PC has to be on** at the scheduled time (or the "run missed task" option above
  will catch up on next boot). For always-on sync, run it on a machine that's always on.
- **macOS/Linux:** use `cron` instead — see the Auto-sync section of the main `README.md`.

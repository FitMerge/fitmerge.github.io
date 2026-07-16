# Automating the Garmin pull (Windows)

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

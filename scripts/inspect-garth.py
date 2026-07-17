#!/usr/bin/env python3
"""Diagnostic: prints the garth / garminconnect API surface on THIS machine and tries
each known way to load the saved token store. Does NOT log in to Garmin (no password,
no rate-limit hit). Run it and share the output so the sync script can be pointed at the
methods your installed versions actually provide.

    python scripts\\inspect-garth.py
"""
import os

tokenstore = os.path.expanduser(os.environ.get("GARMINTOKENS", "~/.garminconnect"))
print("=== token store ===")
print("path:", tokenstore)
print("exists:", os.path.isdir(tokenstore))
if os.path.isdir(tokenstore):
    print("files:", os.listdir(tokenstore))

print("\n=== garth ===")
try:
    import garth

    print("version:", getattr(garth, "__version__", "?"))
    print("module funcs:", [a for a in dir(garth) if not a.startswith("_")])
    try:
        print("garth.client type:", type(garth.client).__name__)
        print("garth.client methods:", [a for a in dir(garth.client) if not a.startswith("_")])
    except Exception as e:
        print("garth.client err:", repr(e))

    # Try each candidate loader against the existing token store.
    candidates = {
        "garth.resume": lambda: garth.resume(tokenstore),
        "garth.load": lambda: getattr(garth, "load")(tokenstore),
        "garth.client.load": lambda: garth.client.load(tokenstore),
        "garth.client.loads": lambda: garth.client.loads(tokenstore),
    }
    for name, fn in candidates.items():
        try:
            fn()
            print(f"LOAD {name}: OK")
            try:
                prof = garth.client.profile
                dn = prof.get("displayName") if isinstance(prof, dict) else None
                print(f"   profile OK, displayName={dn!r}")
            except Exception as e:
                print(f"   profile err: {type(e).__name__}: {e}")
        except Exception as e:
            print(f"LOAD {name}: {type(e).__name__}: {e}")
except Exception as e:
    print("garth import err:", repr(e))

print("\n=== garminconnect ===")
try:
    import inspect

    import garminconnect

    print("version:", getattr(garminconnect, "__version__", "?"))
    try:
        print("Garmin.login signature:", inspect.signature(garminconnect.Garmin.login))
    except Exception as e:
        print("login sig err:", repr(e))
    print(
        "Garmin token-ish attrs:",
        [a for a in dir(garminconnect.Garmin) if any(k in a.lower() for k in ("garth", "token", "login", "dump", "load"))],
    )
except Exception as e:
    print("garminconnect import err:", repr(e))

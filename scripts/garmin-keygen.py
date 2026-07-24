#!/usr/bin/env python3
"""Mint the keypair that protects Garmin logins in transit.

Run once (and again any time you want to rotate):

    pip install cryptography
    python3 scripts/garmin-keygen.py

It prints two values:

  PUBLIC KEY  -> paste into src/config/garminLink.ts (safe to commit; it ships
                 in the app bundle and can only encrypt, never decrypt)
  PRIVATE KEY -> add as the GitHub Actions secret GARMIN_LINK_PRIVATE_KEY
                 (repo -> Settings -> Secrets and variables -> Actions).
                 Never commit this. Anyone holding it can read the Garmin
                 logins your friends have connected.

Rotating invalidates every stored credential: connected users will show as
needing to reconnect, and they simply enter their Garmin login again.
"""

import sys

try:
    from garmin_crypto import generate_keypair
except ImportError:  # running from the repo root rather than scripts/
    sys.path.insert(0, __file__.rsplit("/", 1)[0])
    from garmin_crypto import generate_keypair


def main() -> int:
    public_key, private_key = generate_keypair()

    print()
    print("=" * 72)
    print("PUBLIC KEY — paste into src/config/garminLink.ts (safe to commit)")
    print("=" * 72)
    print(public_key)
    print()
    print("=" * 72)
    print("PRIVATE KEY — add as GitHub secret GARMIN_LINK_PRIVATE_KEY")
    print("             Keep this secret. Do not commit it.")
    print("=" * 72)
    print(private_key)
    print()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

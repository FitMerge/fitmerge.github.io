"""Multi-user Garmin sync — one scheduled job serving everybody who connected.

Rung has no backend; the only thing that can hold a Garmin session is the
owner's GitHub Action. So instead of every friend forking the repo and wiring up
their own secrets, they type their Garmin login into the app, it is sealed with a
public key (see garmin_crypto.py), and this module — running inside that one
Action with the private key — opens it, logs in, and writes the results into
their own Firestore account.

Firestore layout, per user:

    users/{uid}/garmin/cred     written by the app, readable only by this job
        secret        sealed JSON: {"email","password"} or a token store
        kind          "password" (needs linking) | "tokens" (linked)
        mfaSecret     sealed {"code"} while a 2-factor login is waiting
        backfillDays  how far back to pull on the first successful sync
        pullRequestedAt  set by the app's "Sync now" button

    users/{uid}/garmin/status   written by this job, read by the app
        state         idle | pending | needs_mfa | linked | error | needs_relink
        message, email, updatedAt, lastSyncAt

The password is transient: as soon as a login succeeds it is replaced by the
resulting Garmin session tokens, so the stored secret stops being a reusable
password within one run of the linker.
"""

import base64
import contextlib
import json
import os
import random
import shutil
import sys
import tempfile
import time

from garmin_crypto import CryptoError, load_private_key, public_key_of, seal, unseal

# How long a link attempt will sit waiting for the user to type their 2-factor
# code. Garmin's codes expire quickly, so this has to be a live wait inside the
# job rather than "store it and pick it up on the next run".
MFA_WAIT_SECONDS = 240
MFA_POLL_SECONDS = 3

STATE_PENDING = "pending"
STATE_NEEDS_MFA = "needs_mfa"
STATE_LINKED = "linked"
STATE_ERROR = "error"
STATE_NEEDS_RELINK = "needs_relink"


# --------------------------------------------------------------------------
# Firestore helpers
# --------------------------------------------------------------------------

def _cred_ref(db, uid):
    return db.collection("users").document(uid).collection("garmin").document("cred")


def _status_ref(db, uid):
    return db.collection("users").document(uid).collection("garmin").document("status")


def set_status(db, uid, state, message="", **extra):
    from firebase_admin import firestore

    doc = {"state": state, "message": message, "updatedAt": firestore.SERVER_TIMESTAMP}
    doc.update(extra)
    _status_ref(db, uid).set(doc, merge=True)


def read_cred(db, uid):
    snap = _cred_ref(db, uid).get()
    return snap.to_dict() if getattr(snap, "exists", False) else None


def iter_connected_users(db):
    """Yield (uid, cred) for everyone who has a Garmin credential document.

    Uses a collection-group scan so it costs one query no matter how the users
    collection is shaped. The group also contains 'status' documents, which we
    skip by document id."""
    for snap in db.collection_group("garmin").stream():
        ref = snap.reference
        if ref.id != "cred":
            continue
        # users/{uid}/garmin/cred -> the grandparent document is the user
        try:
            uid = ref.parent.parent.id
        except AttributeError:
            continue
        data = snap.to_dict() or {}
        if data.get("secret"):
            yield uid, data


def redact(text, secrets):
    """Scrub credentials out of anything that might reach a log or a status
    document the user can read. Garmin's client libraries have been known to
    echo request bodies in exception messages."""
    out = str(text)
    for secret in secrets:
        if secret and len(str(secret)) >= 3:
            out = out.replace(str(secret), "***")
    return out[:400]


# --------------------------------------------------------------------------
# Token store handling (one isolated directory per user)
# --------------------------------------------------------------------------

def _read_tokenstore(path):
    blob = {}
    if not os.path.isdir(path):
        return blob
    for name in sorted(os.listdir(path)):
        full = os.path.join(path, name)
        if os.path.isfile(full):
            with open(full, "r", encoding="utf-8") as f:
                blob[name] = f.read()
    return blob


def _write_tokenstore(path, blob):
    os.makedirs(path, exist_ok=True)
    for name, content in blob.items():
        # Defend against path traversal from a tampered credential document.
        if not isinstance(name, str) or not isinstance(content, str):
            continue
        if "/" in name or "\\" in name or name.startswith("."):
            continue
        with open(os.path.join(path, name), "w", encoding="utf-8") as f:
            f.write(content)


@contextlib.contextmanager
def isolated_tokenstore(initial_blob=None):
    """A private GARMINTOKENS directory for one user, removed afterwards.

    Without this every account would share ~/.garminconnect and stomp on each
    other's sessions."""
    previous = os.environ.get("GARMINTOKENS")
    path = tempfile.mkdtemp(prefix="rung-garmin-")
    try:
        if initial_blob:
            _write_tokenstore(path, initial_blob)
        os.environ["GARMINTOKENS"] = path
        yield path
    finally:
        if previous is None:
            os.environ.pop("GARMINTOKENS", None)
        else:
            os.environ["GARMINTOKENS"] = previous
        shutil.rmtree(path, ignore_errors=True)


# --------------------------------------------------------------------------
# Login
# --------------------------------------------------------------------------

def _wait_for_mfa_code(db, uid, private_key, deadline):
    """Block until the user types their 2-factor code into the app.

    Called by garminconnect's prompt_mfa hook, so the whole login stays inside
    one live exchange — Garmin's codes expire far too fast to stash the request
    and resume it on a later run."""
    set_status(db, uid, STATE_NEEDS_MFA, "Enter the code Garmin just sent you.")
    print(f"[{uid}] waiting for a 2-factor code…", file=sys.stderr)

    while time.time() < deadline:
        cred = read_cred(db, uid) or {}
        sealed_code = cred.get("mfaSecret")
        if sealed_code:
            try:
                code = json.loads(unseal(sealed_code, private_key)).get("code", "")
            except (CryptoError, json.JSONDecodeError, AttributeError) as exc:
                print(f"[{uid}] unreadable 2-factor code: {exc}", file=sys.stderr)
                code = ""
            _cred_ref(db, uid).update({"mfaSecret": None})
            if code:
                print(f"[{uid}] got the code", file=sys.stderr)
                return code.strip()
        time.sleep(MFA_POLL_SECONDS)

    raise TimeoutError("timed out waiting for the 2-factor code")


def _login_with_password(email, password, mfa_callback):
    from garminconnect import Garmin

    try:
        client = Garmin(email=email, password=password, prompt_mfa=mfa_callback)
    except TypeError:
        # Older garminconnect without the prompt_mfa hook: 2-factor accounts
        # can't be linked this way, but password-only accounts still work.
        client = Garmin(email, password)

    tokenstore = os.environ.get("GARMINTOKENS")
    try:
        client.login(tokenstore)
    except TypeError:
        client.login()
    return client


def _login_with_tokens(tokenstore):
    from garminconnect import Garmin

    client = Garmin()
    client.login(tokenstore)
    return client


def _persist_tokens(client, tokenstore):
    """Make sure the session actually landed on disk so we can store it."""
    if os.path.isdir(tokenstore) and os.listdir(tokenstore):
        return
    for saver in (
        lambda: client.client.dump(tokenstore),
        lambda: getattr(client, "garth").dump(tokenstore),
    ):
        try:
            saver()
        except Exception:  # noqa: BLE001 - try the next shape
            continue
        if os.path.isdir(tokenstore) and os.listdir(tokenstore):
            return


# --------------------------------------------------------------------------
# The two entry points
# --------------------------------------------------------------------------

def link_worker(db, private_key, max_users=3):
    """Finish first-time connections, including the live 2-factor handshake.

    Runs on a short schedule so connecting feels quick; it does no data pulling,
    so a run with nothing to link costs seconds."""
    public_key = public_key_of(private_key)
    linked = 0

    for uid, cred in iter_connected_users(db):
        if cred.get("kind") != "password":
            continue  # already linked, or nothing to do
        if linked >= max_users:
            print(f"more accounts are waiting to link; they'll be picked up next run", file=sys.stderr)
            break
        linked += 1

        password = ""
        try:
            set_status(db, uid, STATE_PENDING, "Signing in to Garmin…")
            secret = json.loads(unseal(cred["secret"], private_key))
            email, password = secret.get("email", ""), secret.get("password", "")
            if not email or not password:
                raise ValueError("missing email or password")

            deadline = time.time() + MFA_WAIT_SECONDS
            with isolated_tokenstore() as tokenstore:
                client = _login_with_password(
                    email, password, lambda: _wait_for_mfa_code(db, uid, private_key, deadline)
                )
                _persist_tokens(client, tokenstore)
                blob = _read_tokenstore(tokenstore)
                if not blob:
                    raise RuntimeError("Garmin session could not be saved")

                # The password has done its job — replace it with the session so
                # what's stored is a revocable token rather than a reusable login.
                _cred_ref(db, uid).set(
                    {"secret": seal(json.dumps(blob), public_key), "kind": "tokens", "mfaSecret": None},
                    merge=True,
                )
                set_status(db, uid, STATE_LINKED, "Connected to Garmin.", email=email)
                print(f"[{uid}] linked", file=sys.stderr)

                # Pull straight away so the user sees data instead of an empty app.
                days = int(cred.get("backfillDays") or 90)
                _sync_with_client(db, uid, client, days)

        except TimeoutError:
            set_status(db, uid, STATE_ERROR, "The code timed out — tap Connect to try again.")
        except CryptoError:
            set_status(db, uid, STATE_ERROR, "Couldn't read your saved login — please reconnect.")
        except Exception as exc:  # noqa: BLE001 - one person's failure must not stop the rest
            message = redact(exc, [password])
            print(f"[{uid}] link failed: {message}", file=sys.stderr)
            set_status(db, uid, STATE_ERROR, _friendly_error(message))

    return linked


def sync_all_users(db, private_key, days=3, skip_uid=None, max_users=10):
    """Routine pull for everyone already linked."""
    synced, failed = 0, 0
    for uid, cred in iter_connected_users(db):
        if cred.get("kind") != "tokens":
            continue  # still linking
        if skip_uid and uid == skip_uid:
            continue  # the owner already synced through the single-user path
        if synced + failed >= max_users:
            print("hit --max-users; the rest will sync on the next run", file=sys.stderr)
            break

        try:
            blob = json.loads(unseal(cred["secret"], private_key))
            with isolated_tokenstore(blob) as tokenstore:
                client = _login_with_tokens(tokenstore)
                _sync_with_client(db, uid, client, days)
            synced += 1
        except CryptoError:
            failed += 1
            set_status(db, uid, STATE_NEEDS_RELINK, "Please reconnect your Garmin account.")
        except Exception as exc:  # noqa: BLE001
            failed += 1
            message = redact(exc, [])
            print(f"[{uid}] sync failed: {message}", file=sys.stderr)
            if _looks_like_expired_session(message):
                set_status(db, uid, STATE_NEEDS_RELINK, "Garmin signed you out — please reconnect.")
            else:
                set_status(db, uid, STATE_ERROR, _friendly_error(message))
        finally:
            # Space out logins so a handful of accounts from one datacenter IP
            # doesn't look like abuse to Garmin.
            time.sleep(random.uniform(3, 8))

    print(f"multi-user sync: {synced} synced, {failed} failed", file=sys.stderr)
    return synced, failed


_main_module_cache = None


def main_module():
    """Import garmin-sync.py, whose hyphenated name blocks a normal import.

    Cached: re-executing it for every user would be pure waste, and the caller
    may already have it loaded as __main__."""
    global _main_module_cache
    if _main_module_cache is None:
        import importlib.util

        here = os.path.dirname(os.path.abspath(__file__))
        spec = importlib.util.spec_from_file_location("garmin_sync_main", os.path.join(here, "garmin-sync.py"))
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        _main_module_cache = module
    return _main_module_cache


def _sync_with_client(db, uid, client, days):
    """Pull `days` of Garmin data with an already-logged-in client and merge it
    into that user's account."""
    module = main_module()

    weights, sessions, health = module.fetch_from_garmin(days, client=client)
    payload = module.build_payload(weights, sessions, health)
    counts = module.push_payload(db, uid, payload)

    from firebase_admin import firestore

    _status_ref(db, uid).set(
        {"state": STATE_LINKED, "lastSyncAt": firestore.SERVER_TIMESTAMP, "message": ""}, merge=True
    )
    print(f"[{uid}] synced {counts[0]} weigh-ins, {counts[1]} new activities, {counts[2]} days", file=sys.stderr)
    return counts


def _looks_like_expired_session(message):
    lowered = message.lower()
    return any(s in lowered for s in ("401", "unauthorized", "expired", "username and password are required"))


def _friendly_error(message):
    """Turn library noise into something a non-technical user can act on."""
    lowered = message.lower()
    if any(s in lowered for s in ("401", "invalid", "credential", "password")):
        return "Garmin didn't accept that email or password."
    if "429" in lowered or "too many" in lowered:
        return "Garmin is rate-limiting us — we'll retry automatically."
    if "mfa" in lowered or "2fa" in lowered:
        return "Two-factor sign-in didn't complete — tap Connect to try again."
    return "Couldn't reach Garmin. We'll try again automatically."


def load_private_key_from_env(env_var="GARMIN_LINK_PRIVATE_KEY"):
    raw = os.environ.get(env_var, "").strip()
    if not raw:
        return None
    try:
        return load_private_key(raw)
    except CryptoError as exc:
        print(f"error: {env_var} is not a valid private key: {exc}", file=sys.stderr)
        return None


def self_test():
    """Offline checks for the parts that don't need Garmin or Firestore."""
    checks = []

    # redact() must scrub credentials out of anything user- or log-facing.
    scrubbed = redact("login failed for pw=hunter2 at /oauth", ["hunter2"])
    checks.append(("redact removes the password", "hunter2" not in scrubbed))
    checks.append(("redact keeps context", "login failed" in scrubbed))
    checks.append(("redact ignores trivially short secrets", "ab" in redact("ab cd", ["ab"])))
    checks.append(("redact truncates runaway messages", len(redact("x" * 5000, [])) <= 400))

    # Token stores must be isolated per user and cleaned up.
    with isolated_tokenstore({"oauth1_token.json": "A"}) as first:
        checks.append(("tokenstore is exported to garth", os.environ["GARMINTOKENS"] == first))
        checks.append(("initial blob is materialised", _read_tokenstore(first) == {"oauth1_token.json": "A"}))
        with isolated_tokenstore({"oauth1_token.json": "B"}) as second:
            checks.append(("a second user gets a different directory", first != second))
            checks.append(("and cannot see the first user's session", _read_tokenstore(second)["oauth1_token.json"] == "B"))
    checks.append(("directories are removed afterwards", not os.path.exists(first)))
    checks.append(("GARMINTOKENS is restored", "GARMINTOKENS" not in os.environ))

    # Path traversal in a tampered credential document must not escape.
    with isolated_tokenstore({"../escape": "x", "ok.json": "y"}) as path:
        checks.append(("path traversal is ignored", _read_tokenstore(path) == {"ok.json": "y"}))
        checks.append(("no file escaped the directory", not os.path.exists(os.path.join(path, "..", "escape"))))

    checks.append(("expired sessions are recognised", _looks_like_expired_session("HTTP 401 Unauthorized")))
    checks.append(("ordinary errors are not", not _looks_like_expired_session("connection reset")))
    checks.append(("bad passwords get a clear message", "email or password" in _friendly_error("401 invalid credential")))
    checks.append(("rate limits get a clear message", "rate-limiting" in _friendly_error("HTTP 429 too many requests")))

    for name, ok in checks:
        print(("ok  - " if ok else "FAIL- ") + name)
    failed = [n for n, ok in checks if not ok]
    print("\nALL PASS" if not failed else f"\n{len(failed)} FAILED")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(self_test())

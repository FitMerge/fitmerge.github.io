"""Envelope encryption for Garmin credentials in transit through Firestore.

Garmin has no "connect an app" flow, so an automated pull needs the user's real
login. To keep that out of the database in readable form, the browser seals it
with a public key that ships in the app bundle; only the sync job — which holds
the matching private key as a GitHub Actions secret — can open it. A dump of
Firestore on its own yields nothing but ciphertext.

Scheme (mirrored by src/services/garmin/linkCrypto.ts using WebCrypto):

    ECIES = ephemeral P-256 ECDH -> HKDF-SHA256 -> AES-256-GCM

    envelope := "v1" "." b64(ephemeral public key, X9.62 uncompressed)
                     "." b64(12-byte nonce)
                     "." b64(ciphertext || GCM tag)

The ephemeral keypair is per-message, so two seals of the same password differ
and no key material is ever reused.
"""

import base64
import os

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

VERSION = "v1"
# Fixed, non-secret domain separation. HKDF's salt is optional; what matters is
# that both sides agree, and that `info` pins the derived key to this use.
_HKDF_SALT = b"\x00" * 32
_HKDF_INFO = b"fitmerge-garmin-v1"
_NONCE_BYTES = 12


class CryptoError(Exception):
    """Raised when an envelope can't be opened — malformed, tampered, or wrong key."""


def _b64d(text: str) -> bytes:
    # Tolerate missing padding: some transports strip trailing '='.
    pad = "=" * (-len(text) % 4)
    return base64.b64decode(text + pad)


def _b64e(raw: bytes) -> str:
    return base64.b64encode(raw).decode("ascii")


def _derive(shared: bytes) -> bytes:
    return HKDF(
        algorithm=hashes.SHA256(), length=32, salt=_HKDF_SALT, info=_HKDF_INFO
    ).derive(shared)


def generate_keypair() -> tuple[str, str]:
    """Returns (public_key_b64_spki, private_key_b64_pkcs8) for a fresh P-256 pair."""
    private = ec.generate_private_key(ec.SECP256R1())
    priv_der = private.private_bytes(
        encoding=serialization.Encoding.DER,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    pub_der = private.public_key().public_bytes(
        encoding=serialization.Encoding.DER,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    return _b64e(pub_der), _b64e(priv_der)


def load_private_key(b64_pkcs8: str) -> ec.EllipticCurvePrivateKey:
    try:
        key = serialization.load_der_private_key(_b64d(b64_pkcs8.strip()), password=None)
    except Exception as exc:  # noqa: BLE001 - surfaced as one clear error
        raise CryptoError(f"private key is not valid base64 PKCS8 DER: {exc}") from exc
    if not isinstance(key, ec.EllipticCurvePrivateKey):
        raise CryptoError("private key is not an elliptic-curve key")
    return key


def load_public_key(b64_spki: str) -> ec.EllipticCurvePublicKey:
    try:
        key = serialization.load_der_public_key(_b64d(b64_spki.strip()))
    except Exception as exc:  # noqa: BLE001
        raise CryptoError(f"public key is not valid base64 SPKI DER: {exc}") from exc
    if not isinstance(key, ec.EllipticCurvePublicKey):
        raise CryptoError("public key is not an elliptic-curve key")
    return key


def seal(plaintext: str, public_key: ec.EllipticCurvePublicKey) -> str:
    """Encrypt to the holder of the matching private key. Used by the runner to
    store refreshed Garmin session tokens it will need on the next run."""
    ephemeral = ec.generate_private_key(ec.SECP256R1())
    shared = ephemeral.exchange(ec.ECDH(), public_key)
    aes = AESGCM(_derive(shared))
    nonce = os.urandom(_NONCE_BYTES)
    ciphertext = aes.encrypt(nonce, plaintext.encode("utf-8"), None)
    epk = ephemeral.public_key().public_bytes(
        encoding=serialization.Encoding.X962,
        format=serialization.PublicFormat.UncompressedPoint,
    )
    return ".".join([VERSION, _b64e(epk), _b64e(nonce), _b64e(ciphertext)])


def unseal(envelope: str, private_key: ec.EllipticCurvePrivateKey) -> str:
    """Open an envelope sealed by the browser (or by seal() above)."""
    if not isinstance(envelope, str) or not envelope:
        raise CryptoError("empty envelope")
    parts = envelope.split(".")
    if len(parts) != 4:
        raise CryptoError("envelope should have 4 dot-separated parts")
    version, epk_b64, nonce_b64, ct_b64 = parts
    if version != VERSION:
        raise CryptoError(f"unsupported envelope version {version!r}")

    try:
        epk_raw, nonce, ciphertext = _b64d(epk_b64), _b64d(nonce_b64), _b64d(ct_b64)
    except Exception as exc:  # noqa: BLE001
        raise CryptoError(f"envelope is not valid base64: {exc}") from exc

    if len(nonce) != _NONCE_BYTES:
        raise CryptoError("bad nonce length")

    try:
        ephemeral_pub = ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256R1(), epk_raw)
    except Exception as exc:  # noqa: BLE001
        raise CryptoError(f"bad ephemeral public key: {exc}") from exc

    shared = private_key.exchange(ec.ECDH(), ephemeral_pub)
    try:
        return AESGCM(_derive(shared)).decrypt(nonce, ciphertext, None).decode("utf-8")
    except Exception as exc:  # noqa: BLE001
        # Wrong key or tampered ciphertext both land here; don't leak which.
        raise CryptoError("could not decrypt — wrong key or corrupted data") from exc


def public_key_of(private_key: ec.EllipticCurvePrivateKey) -> ec.EllipticCurvePublicKey:
    return private_key.public_key()


def self_test() -> int:
    """Offline round-trip checks. `python3 scripts/garmin_crypto.py`"""
    checks: list[tuple[str, bool]] = []

    pub_b64, priv_b64 = generate_keypair()
    priv, pub = load_private_key(priv_b64), load_public_key(pub_b64)

    secret = '{"email":"a@b.com","password":"hunter2 üñïçø∂é"}'
    envelope = seal(secret, pub)
    checks.append(("round-trips through seal/unseal", unseal(envelope, priv) == secret))
    checks.append(("envelope is versioned", envelope.startswith("v1.")))
    checks.append(("plaintext never appears in the envelope", "hunter2" not in envelope))
    checks.append(("same input seals differently each time", seal(secret, pub) != seal(secret, pub)))

    # A tampered ciphertext must fail loudly, not decrypt to garbage.
    version, epk, nonce, ct = envelope.split(".")
    raw = bytearray(_b64d(ct))
    raw[0] ^= 0x01
    tampered = ".".join([version, epk, nonce, _b64e(bytes(raw))])
    checks.append(("tampered ciphertext is rejected", _raises(lambda: unseal(tampered, priv))))

    # A different key must not open it.
    _, other_priv_b64 = generate_keypair()
    other = load_private_key(other_priv_b64)
    checks.append(("wrong key is rejected", _raises(lambda: unseal(envelope, other))))

    for bad in ["", "nope", "v1.a.b", "v2." + ".".join([epk, nonce, ct])]:
        checks.append((f"malformed envelope rejected: {bad[:12]!r}", _raises(lambda b=bad: unseal(b, priv))))

    # Large payloads (a full garth token store) must work — this is why the
    # scheme is hybrid rather than raw public-key encryption.
    big = "x" * 200_000
    checks.append(("handles a large token blob", unseal(seal(big, pub), priv) == big))

    for name, ok in checks:
        print(("ok  - " if ok else "FAIL- ") + name)
    failed = [n for n, ok in checks if not ok]
    print("\nALL PASS" if not failed else f"\n{len(failed)} FAILED")
    return 1 if failed else 0


def _raises(fn) -> bool:
    try:
        fn()
    except CryptoError:
        return True
    except Exception:  # noqa: BLE001 - any rejection is acceptable, silent success is not
        return True
    return False


if __name__ == "__main__":
    raise SystemExit(self_test())

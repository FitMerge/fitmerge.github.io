// Seals a Garmin login in the browser so it can travel through Firestore
// without ever being stored in readable form. Only the sync job — which holds
// the matching private key as a GitHub Actions secret — can open it.
//
// Scheme (mirrored by scripts/garmin_crypto.py):
//   ECIES = ephemeral P-256 ECDH -> HKDF-SHA256 -> AES-256-GCM
//   envelope := "v1.<b64 ephemeral pubkey>.<b64 nonce>.<b64 ciphertext||tag>"
//
// WebCrypto only — no dependency, and the private key never exists on a device.

import { GARMIN_LINK_PUBLIC_KEY } from '../../config/garminLink'

const VERSION = 'v1'
const HKDF_SALT = new Uint8Array(32) // fixed + non-secret; both sides must agree
const HKDF_INFO = new TextEncoder().encode('fitmerge-garmin-v1')
const NONCE_BYTES = 12

export class LinkCryptoError extends Error {}

function b64encode(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes)
  let binary = ''
  // Chunked to avoid blowing the argument limit on large token blobs.
  const CHUNK = 0x8000
  for (let i = 0; i < view.length; i += CHUNK) {
    binary += String.fromCharCode(...view.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

function b64decode(text: string): ArrayBuffer {
  const binary = atob(text)
  const out = new Uint8Array(new ArrayBuffer(binary.length))
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out.buffer
}

function subtle(): SubtleCrypto {
  const c = globalThis.crypto
  if (!c?.subtle) {
    // Browsers only expose WebCrypto over HTTPS (localhost excepted).
    throw new LinkCryptoError('Secure connection required to connect Garmin.')
  }
  return c.subtle
}

/** True when a public key has actually been baked in — lets the UI hide the
 * Garmin connect flow rather than offering something that cannot work. */
export function garminLinkAvailable(): boolean {
  return GARMIN_LINK_PUBLIC_KEY.trim().length > 0
}

async function deriveAesKey(
  ephemeralPrivate: CryptoKey,
  recipient: CryptoKey,
): Promise<CryptoKey> {
  const shared = await subtle().deriveBits({ name: 'ECDH', public: recipient }, ephemeralPrivate, 256)
  const hkdfKey = await subtle().importKey('raw', shared, 'HKDF', false, ['deriveKey'])
  return subtle().deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: HKDF_SALT, info: HKDF_INFO },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt'],
  )
}

/**
 * Encrypt `plaintext` to the sync job's public key. Every call uses a fresh
 * ephemeral keypair, so sealing the same password twice yields different
 * envelopes and no key material is ever reused.
 */
export async function seal(plaintext: string, publicKeyB64 = GARMIN_LINK_PUBLIC_KEY): Promise<string> {
  if (!publicKeyB64.trim()) {
    throw new LinkCryptoError('Garmin connect isn’t set up in this build yet.')
  }

  let recipient: CryptoKey
  try {
    recipient = await subtle().importKey(
      'spki',
      b64decode(publicKeyB64.trim()),
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      [],
    )
  } catch (err) {
    throw new LinkCryptoError(`Couldn’t read the sync key: ${err instanceof Error ? err.message : 'bad key'}`)
  }

  const ephemeral = await subtle().generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits'])
  const aesKey = await deriveAesKey(ephemeral.privateKey, recipient)

  const nonce = crypto.getRandomValues(new Uint8Array(NONCE_BYTES))
  const ciphertext = await subtle().encrypt(
    { name: 'AES-GCM', iv: nonce },
    aesKey,
    new TextEncoder().encode(plaintext),
  )
  const epk = await subtle().exportKey('raw', ephemeral.publicKey) // X9.62 uncompressed

  return [VERSION, b64encode(epk), b64encode(nonce.buffer), b64encode(ciphertext)].join('.')
}

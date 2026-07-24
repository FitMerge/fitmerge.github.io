// Parsing + persistence for the user's own Firebase project config. These
// values (apiKey, authDomain, projectId, appId, ...) are NOT secret — Firebase
// web apps ship them in client bundles by design; access is controlled by
// Firestore security rules, not by hiding this config. Safe to store in
// localStorage and safe for the user to paste from the Firebase console.

export type FirebaseConfig = {
  apiKey: string
  authDomain: string
  projectId: string
  appId: string
  messagingSenderId?: string
  storageBucket?: string
}

import { DEFAULT_FIREBASE_CONFIG } from '../../config/firebaseDefault'

const STORAGE_KEY = 'fm-firebase-config'

const REQUIRED_KEYS = ['apiKey', 'authDomain', 'projectId', 'appId'] as const
const OPTIONAL_KEYS = ['messagingSenderId', 'storageBucket'] as const
const ALL_KEYS = [...REQUIRED_KEYS, ...OPTIONAL_KEYS]

/**
 * Accepts either strict JSON (`{"apiKey": "...", ...}`) or the JS snippet the
 * Firebase console shows (`const firebaseConfig = { apiKey: "..", .. };`).
 * Returns null if the pasted text doesn't yield all required fields.
 */
export function parseFirebaseConfig(pasted: string): FirebaseConfig | null {
  const trimmed = pasted.trim()
  if (!trimmed) return null

  const fromJson = tryParseJson(trimmed)
  const fields: Record<string, string> = {}

  for (const key of ALL_KEYS) {
    const jsonValue = fromJson && typeof fromJson[key] === 'string' ? (fromJson[key] as string) : ''
    const value = jsonValue || extractField(trimmed, key)
    if (value) fields[key] = value
  }

  for (const key of REQUIRED_KEYS) {
    if (!fields[key]) return null
  }

  const config: FirebaseConfig = {
    apiKey: fields.apiKey,
    authDomain: fields.authDomain,
    projectId: fields.projectId,
    appId: fields.appId,
  }
  if (fields.messagingSenderId) config.messagingSenderId = fields.messagingSenderId
  if (fields.storageBucket) config.storageBucket = fields.storageBucket
  return config
}

function tryParseJson(text: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(text)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
    return null
  } catch {
    return null
  }
}

/** Lenient regex extraction of `key: "value"` / `key : 'value'` from a JS snippet. */
function extractField(text: string, key: string): string {
  const match = text.match(new RegExp(`["']?${key}["']?\\s*:\\s*["']([^"']*)["']`))
  return match ? match[1].trim() : ''
}

export function loadFirebaseConfig(): FirebaseConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    // No device-specific config saved → fall back to the baked-in default so a
    // new device works with just "Sign in with Google".
    if (!raw) return DEFAULT_FIREBASE_CONFIG
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return DEFAULT_FIREBASE_CONFIG
    const obj = parsed as Record<string, unknown>
    if (
      typeof obj.apiKey !== 'string' ||
      typeof obj.authDomain !== 'string' ||
      typeof obj.projectId !== 'string' ||
      typeof obj.appId !== 'string'
    ) {
      return DEFAULT_FIREBASE_CONFIG
    }
    const config: FirebaseConfig = {
      apiKey: obj.apiKey,
      authDomain: obj.authDomain,
      projectId: obj.projectId,
      appId: obj.appId,
    }
    if (typeof obj.messagingSenderId === 'string') config.messagingSenderId = obj.messagingSenderId
    if (typeof obj.storageBucket === 'string') config.storageBucket = obj.storageBucket
    return config
  } catch {
    return DEFAULT_FIREBASE_CONFIG
  }
}

export function saveFirebaseConfig(cfg: FirebaseConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg))
}

export function clearFirebaseConfig(): void {
  localStorage.removeItem(STORAGE_KEY)
}

export function hasFirebaseConfig(): boolean {
  return loadFirebaseConfig() !== null
}

/**
 * True only when THIS device pasted its own config, as opposed to riding on the
 * baked-in default. Lets the UI show "use my own Firebase project" controls to
 * the rare power user without offering them to everyone else.
 */
export function hasDeviceConfig(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null
  } catch {
    return false
  }
}

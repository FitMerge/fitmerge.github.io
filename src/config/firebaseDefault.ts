import type { FirebaseConfig } from '../services/sync/firebaseConfig'

// Baked-in Firebase project config so a NEW device needs nothing but "Sign in
// with Google" — no pasting a config snippet first. These values are NOT secret:
// Firebase web configs are meant to ship in the client bundle, and all access is
// enforced by Firebase Auth + your per-user Firestore rules, not by hiding them.
//
// If localStorage already has a config (e.g. a device that pasted one manually),
// that wins; this is only the fallback. Set to `null` to require per-device paste.
export const DEFAULT_FIREBASE_CONFIG: FirebaseConfig | null = null

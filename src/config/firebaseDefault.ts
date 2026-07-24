import type { FirebaseConfig } from '../services/sync/firebaseConfig'

// Baked-in Firebase project config so a NEW device needs nothing but "Sign in
// with Google" — no pasting a config snippet first. These values are NOT secret:
// Firebase web configs are meant to ship in the client bundle, and all access is
// enforced by Firebase Auth + the per-user rules in firestore.rules (repo root),
// not by hiding them.
//
// If localStorage already has a config (e.g. a device that pasted one manually),
// that wins; this is only the fallback. Set to `null` to require per-device paste.
export const DEFAULT_FIREBASE_CONFIG: FirebaseConfig | null = {
  apiKey: 'AIzaSyA9zjX0KKJ1V0o_6PHKfbnNqb80_JqMrZU',
  authDomain: 'test-fitness-tracker.firebaseapp.com',
  projectId: 'test-fitness-tracker',
  storageBucket: 'test-fitness-tracker.firebasestorage.app',
  messagingSenderId: '390873599685',
  appId: '1:390873599685:web:3e433eec975465cfa2aaac',
}

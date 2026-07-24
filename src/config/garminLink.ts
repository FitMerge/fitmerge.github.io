// Public half of the keypair that protects Garmin logins on their way to the
// sync job. Safe to commit and to ship in the app bundle: it can only encrypt.
// The private half lives solely as the GitHub Actions secret
// GARMIN_LINK_PRIVATE_KEY, so a copy of this repo — or of the Firestore
// database — is not enough to read anyone's Garmin credentials.
//
// Regenerate with `python3 scripts/garmin-keygen.py`. Rotating invalidates
// every stored credential; connected users are asked to reconnect.
//
// Empty string disables the in-app Garmin connect flow entirely.
export const GARMIN_LINK_PUBLIC_KEY =
  'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEH8YY5u+dv0rFuLLBzBI6rF/YAC7aPGLgNlKYGRIk+6+gWLUzxXEc8/T3w9Dc+Uda+pRpk52/ah0gRKGbk5wSaQ=='

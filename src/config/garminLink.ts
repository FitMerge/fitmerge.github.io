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
  'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE6QmLVFQV/QsQUdcH1NeZt0MAEUNAAWMZngU8YkxMSdvJ1UgntW4Q0W8kQagle+soKJ2XeLaf+rW3K4wqSWNtvQ=='

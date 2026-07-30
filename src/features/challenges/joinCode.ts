// The challenge join code.
//
// This code IS the Firestore document id, and possession of it is what grants
// access to the board (see firestore.rules) — so it has to be unguessable enough
// that nobody stumbles into someone else's challenge, and readable enough to say
// out loud.

/**
 * Crockford-style alphabet: no 0/O, no 1/I/L, no U. Removing the ambiguous pairs
 * matters more than the lost entropy, because these codes get read off a screen
 * and typed by hand.
 */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ'

/** 8 characters over a 30-character alphabet ≈ 6.6e11 combinations. */
const CODE_LENGTH = 8

function randomIndexes(count: number): number[] {
  const out: number[] = []
  if (typeof crypto === 'undefined' || typeof crypto.getRandomValues !== 'function') {
    for (let i = 0; i < count; i++) out.push(Math.floor(Math.random() * ALPHABET.length))
    return out
  }
  // Rejection sampling on 5 bits (0..31), discarding the two values above the
  // alphabet. Plain `byte % 30` would make the first 16 letters slightly more
  // likely — harmless here, but the fix is two lines.
  while (out.length < count) {
    const bytes = new Uint8Array(count)
    crypto.getRandomValues(bytes)
    for (const b of bytes) {
      const i = b & 31
      if (i < ALPHABET.length && out.length < count) out.push(i)
    }
  }
  return out
}

export function generateJoinCode(): string {
  return randomIndexes(CODE_LENGTH)
    .map((i) => ALPHABET[i])
    .join('')
}

/**
 * Clean up a code as typed: uppercase, and strip anything not in the alphabet —
 * which covers the spaces and dashes people add for readability as well as the
 * ambiguous characters a code can never contain. Returns a short string when the
 * input was wrong, so callers can treat "not CODE_LENGTH" as invalid.
 */
export function normalizeCode(input: string): string {
  return input
    .trim()
    .toUpperCase()
    .split('')
    .filter((ch) => ALPHABET.includes(ch))
    .join('')
    .slice(0, CODE_LENGTH)
}

export function isValidCode(input: string): boolean {
  return normalizeCode(input).length === CODE_LENGTH
}

/** 'AB34-CD78' — grouped for reading aloud. Display only; never stored. */
export function formatCode(code: string): string {
  if (code.length !== CODE_LENGTH) return code
  return `${code.slice(0, 4)}-${code.slice(4)}`
}

/**
 * Invite link. The app uses HashRouter, so a deep link needs no server-side
 * rewrite — it works on GitHub Pages exactly as served.
 */
export function inviteLink(code: string): string {
  const { origin, pathname } = window.location
  return `${origin}${pathname}#/challenges/join/${code}`
}

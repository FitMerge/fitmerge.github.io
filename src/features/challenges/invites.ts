// Email handling for challenge invites.
//
// An invite is a document whose ID is the invited email address, which is what
// lets a security rule answer "is this person allowed in?" with a single
// exists() check and no query. That makes the exact spelling load-bearing: a
// stored "Josh@Gmail.com " never matches the "josh@gmail.com" Firebase puts in
// the auth token, and the person just sees a permission error they can't act on.
//
// So every address goes through `normalizeEmail` on the way in — both when the
// organiser types it and when we look up our own.

/** Lowercased and trimmed. Firebase issues `token.email` lowercased. */
export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase()
}

/**
 * Deliberately permissive: this only needs to catch typos and stray text, not
 * adjudicate RFC 5322. Anything shaped like `a@b.c` with no whitespace passes.
 */
export function isValidEmail(input: string): boolean {
  const email = normalizeEmail(input)
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

/**
 * Firestore document IDs cannot contain '/', and '.' / '..' are reserved when
 * they are the entire ID. Real email addresses hit none of these, but a pasted
 * string might, and a bad ID throws rather than failing gracefully.
 */
export function isUsableAsDocId(email: string): boolean {
  const id = normalizeEmail(email)
  return id.length > 0 && id.length <= 1500 && !id.includes('/') && id !== '.' && id !== '..'
}

/**
 * Split a pasted list into addresses. Accepts commas, semicolons, newlines and
 * spaces, because people paste from wherever they already have the addresses.
 * Invalid fragments are returned separately rather than silently dropped — an
 * invite that never arrives is worse than an error message.
 */
export function parseEmailList(input: string): { valid: string[]; invalid: string[] } {
  const parts = input
    .split(/[,;\s]+/)
    .map(normalizeEmail)
    .filter((p) => p.length > 0)

  const valid: string[] = []
  const invalid: string[] = []
  for (const part of parts) {
    if (isValidEmail(part) && isUsableAsDocId(part)) {
      if (!valid.includes(part)) valid.push(part)
    } else {
      invalid.push(part)
    }
  }
  return { valid, invalid }
}

/** 'josh@gmail.com' → 'josh' — the board shows names, this is for the roster. */
export function emailLabel(email: string): string {
  const at = email.indexOf('@')
  return at > 0 ? email.slice(0, at) : email
}

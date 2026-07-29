// Same meal typed twice must produce the same numbers.
//
// It did not. Macro estimation ran at temperature 0.2, so "eggs cooked in oil"
// came back 119 kcal one day and 124 the next — noise presented as an exact
// integer. Pinning the sampling makes the model far more repeatable, but "far
// more" is not "always": these APIs give no determinism guarantee even at
// temperature 0.
//
// So the answer is remembered rather than re-derived. Ask the same thing and you
// get literally the same object back, which also makes it instant and free.
//
// This is a cache for CONSISTENCY first and speed second, which is why it keys on
// the meaning of the request rather than its exact bytes.

const KEY = 'fm-food-parse-cache'
/** Entries kept. A food diary revisits the same handful of meals constantly, so
 * a small cache has a high hit rate; this exists to bound localStorage, not to
 * ration hits. */
const MAX_ENTRIES = 80
/** Old enough that the model behind it may have changed materially. */
const TTL_MS = 30 * 24 * 60 * 60 * 1000

type Entry<T> = { key: string; value: T; ts: number }

/**
 * The cache key: what the user MEANT, not what they typed.
 *
 * "Eggs cooked in oil", "eggs cooked in  oil " and "eggs cooked in oil." are the
 * same meal, and getting different macros for them would be the same bug wearing
 * a different hat.
 */
export function cacheKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,;!?]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function read<T>(): Entry<T>[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as Entry<T>[]) : []
  } catch {
    // A corrupt or unavailable store must never break logging a meal.
    return []
  }
}

function write<T>(entries: Entry<T>[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries))
  } catch {
    // Quota exceeded or private mode — losing the cache is survivable.
  }
}

/** The remembered result for `text`, or null when there is none or it has aged out. */
export function getCached<T>(text: string, now = Date.now()): T | null {
  const key = cacheKey(text)
  const hit = read<T>().find((e) => e.key === key)
  if (!hit) return null
  if (now - hit.ts > TTL_MS) return null
  return hit.value
}

/** Remember `value` for `text`, replacing any previous answer for that meaning. */
export function setCached<T>(text: string, value: T, now = Date.now()): void {
  const key = cacheKey(text)
  const rest = read<T>().filter((e) => e.key !== key)
  const next = [{ key, value, ts: now }, ...rest]
    // Newest first, so the trim drops the least recently written.
    .sort((a, b) => b.ts - a.ts)
    .slice(0, MAX_ENTRIES)
  write(next)
}

/** Used by the explicit redo action, which is a request for a second opinion. */
export function forgetCached(text: string): void {
  const key = cacheKey(text)
  write(read().filter((e) => e.key !== key))
}

import { describe, expect, it } from 'vitest'
import { emailLabel, isUsableAsDocId, isValidEmail, normalizeEmail, parseEmailList } from './invites'

// The stored email IS the invite document's ID, and the security rule matches it
// against request.auth.token.email. Any mismatch locks a legitimately invited
// person out with an error they cannot fix themselves, so normalization is the
// load-bearing part of this module.
describe('normalizeEmail', () => {
  it('lowercases and trims, so a typed address matches the auth token', () => {
    expect(normalizeEmail('  Josh@Gmail.COM ')).toBe('josh@gmail.com')
  })

  it('leaves an already-clean address alone', () => {
    expect(normalizeEmail('sam@example.com')).toBe('sam@example.com')
  })
})

describe('isValidEmail', () => {
  it.each(['josh@gmail.com', 'a.b+tag@sub.example.co.uk', '  Sam@Example.com  '])(
    'accepts %j',
    (email) => {
      expect(isValidEmail(email)).toBe(true)
    },
  )

  it.each(['', 'josh', 'josh@', '@gmail.com', 'josh@gmail', 'a b@c.com', 'two@addresses.com x@y.com'])(
    'rejects %j',
    (email) => {
      expect(isValidEmail(email)).toBe(false)
    },
  )
})

describe('isUsableAsDocId', () => {
  it('accepts an ordinary address', () => {
    expect(isUsableAsDocId('josh@gmail.com')).toBe(true)
  })

  // A slash or a bare dot throws when used as a document ID rather than
  // failing gracefully, so they are screened before the write.
  it.each(['a/b@c.com', '.', '..', ''])('rejects %j', (id) => {
    expect(isUsableAsDocId(id)).toBe(false)
  })
})

describe('parseEmailList', () => {
  it('splits on commas, semicolons, newlines and spaces', () => {
    const { valid } = parseEmailList('a@x.com, b@x.com;c@x.com\nd@x.com e@x.com')
    expect(valid).toEqual(['a@x.com', 'b@x.com', 'c@x.com', 'd@x.com', 'e@x.com'])
  })

  it('normalizes as it goes', () => {
    expect(parseEmailList('Josh@Gmail.com').valid).toEqual(['josh@gmail.com'])
  })

  it('deduplicates, including addresses that differ only in case', () => {
    expect(parseEmailList('a@x.com, A@X.com, a@x.com').valid).toEqual(['a@x.com'])
  })

  // Silently dropping a malformed address means an invite that never arrives
  // and nobody knows why.
  it('reports bad fragments rather than discarding them', () => {
    const { valid, invalid } = parseEmailList('good@x.com, nonsense, other@y.com')
    expect(valid).toEqual(['good@x.com', 'other@y.com'])
    expect(invalid).toEqual(['nonsense'])
  })

  it('handles an empty or whitespace-only list', () => {
    expect(parseEmailList('   ')).toEqual({ valid: [], invalid: [] })
  })

  it('ignores trailing separators', () => {
    expect(parseEmailList('a@x.com,').valid).toEqual(['a@x.com'])
  })
})

describe('emailLabel', () => {
  it('shows the local part', () => {
    expect(emailLabel('josh.wright@gmail.com')).toBe('josh.wright')
  })

  it('falls back to the whole string when there is no @', () => {
    expect(emailLabel('mystery')).toBe('mystery')
  })
})

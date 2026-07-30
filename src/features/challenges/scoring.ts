// Scoring for accountability challenges.
//
// The premise that makes this work: everybody picks their OWN habits, but habit
// weights are percentages of the day, so every member's day is worth the same
// DAY_POINTS no matter how many habits they chose. Three habits versus six
// doesn't distort the board — it measures how consistently you hit the
// commitments you made, on one scale.
//
// A perfect day earns a bonus on top (10% by default), so the ceiling is 110.
//
// Everything here is pure: no React, no Firebase, no store imports. The caller
// supplies a `done` predicate, which is what lets the same functions score the
// local supplements log and a peer's published document.

import { addDays } from '../../lib/date'

export type Challenge = {
  /** The 8-character join code. It is also the Firestore document id. */
  code: string
  name: string
  ownerUid: string
  /** ISO 'YYYY-MM-DD', inclusive. */
  startDate: string
  /** ISO 'YYYY-MM-DD', inclusive. */
  endDate: string
  /** 0 = points never reset, 7 = weekly, 28 = monthly. Anchored to startDate. */
  periodDays: 0 | 7 | 28
  /** Fraction added for a fully completed day. 0.1 = the 10% multiplier. */
  bonusPct: number
  archived?: boolean
}

/** One member's result for one day. */
export type DayScore = {
  /** How many of their habits were completed. */
  done: number
  /** How many habits they committed to. */
  total: number
  points: number
}

/** dateISO → that day's score. */
export type ScoreDays = Record<string, DayScore>

/**
 * What a fully completed day is worth before the bonus. Weights are percentages
 * of this, which is precisely why members with different habit counts stay
 * comparable.
 */
export const DAY_POINTS = 100

/** The default full-day bonus — Josh's "10% multiplier". */
export const DEFAULT_BONUS_PCT = 0.1

/** Longest challenge we will score, matching the `days.size() <= 400` rule. */
export const MAX_CHALLENGE_DAYS = 400

/**
 * Whole days from `from` to `to`. Built on Date.UTC deliberately: UTC has no
 * daylight-saving transitions, so the difference is always an exact multiple of
 * 86400000. The same subtraction on local Dates is off by an hour twice a year
 * and floors to the wrong day.
 */
function utcDay(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)
}

function daysBetween(from: string, to: string): number {
  return Math.round((utcDay(to) - utcDay(from)) / 86_400_000)
}

/** 0-based day number of `date` within the challenge; -1 if it falls outside. */
export function dayIndex(c: Challenge, date: string): number {
  if (date < c.startDate || date > c.endDate) return -1
  return daysBetween(c.startDate, date)
}

/**
 * Every date the challenge can be scored on, ending at whichever comes first:
 * the finish date, or `today`. Clamping at today is what stops a device with a
 * wrong clock — or simply a friend in a leading timezone — from banking days
 * that haven't happened.
 */
export function challengeDates(c: Challenge, today: string): string[] {
  const last = today < c.endDate ? today : c.endDate
  if (last < c.startDate) return []
  const dates: string[] = []
  for (let d = c.startDate; d <= last; d = addDays(d, 1)) {
    dates.push(d)
    if (dates.length >= MAX_CHALLENGE_DAYS) break
  }
  return dates
}

/** Total length in days, inclusive of both ends. */
export function challengeLength(c: Challenge): number {
  return daysBetween(c.startDate, c.endDate) + 1
}

/**
 * Weights rescaled to total exactly DAY_POINTS.
 *
 * The editor tries to keep them at 100, but a half-finished edit, a rounding
 * remainder or a habit deleted from the checklist can all leave them short or
 * over. Normalizing here rather than trusting the raw numbers means a member can
 * never — accidentally or otherwise — hand themselves a 140-point day. Weights
 * that are all zero (or absent) fall back to an equal split.
 */
export function normalizedWeights(weights: Record<string, number>): Record<string, number> {
  const ids = Object.keys(weights)
  if (ids.length === 0) return {}
  const sum = ids.reduce((acc, id) => acc + Math.max(0, weights[id] ?? 0), 0)
  if (sum <= 0) {
    const equal = DAY_POINTS / ids.length
    return Object.fromEntries(ids.map((id) => [id, equal]))
  }
  const scale = DAY_POINTS / sum
  return Object.fromEntries(ids.map((id) => [id, Math.max(0, weights[id] ?? 0) * scale]))
}

/**
 * Score one day. `done(habitId)` is the only input about completion, which keeps
 * this a pure function of its arguments and lets the tests drive it directly.
 */
export function scoreDay(
  c: Challenge,
  weights: Record<string, number>,
  done: (habitId: string) => boolean,
): DayScore {
  const norm = normalizedWeights(weights)
  const ids = Object.keys(norm)
  let earned = 0
  let doneCount = 0
  for (const id of ids) {
    if (!done(id)) continue
    doneCount++
    earned += norm[id] ?? 0
  }
  // `total > 0` matters: with no habits chosen, every habit is vacuously
  // complete, and without this guard an empty commitment would earn the
  // perfect-day bonus every single day.
  const perfect = ids.length > 0 && doneCount === ids.length
  const points = Math.round(earned) + (perfect ? Math.round(DAY_POINTS * c.bonusPct) : 0)
  return { done: doneCount, total: ids.length, points }
}

/** The whole days map, ready to publish. */
export function scoreAll(
  c: Challenge,
  weights: Record<string, number>,
  done: (date: string, habitId: string) => boolean,
  today: string,
): ScoreDays {
  const days: ScoreDays = {}
  for (const date of challengeDates(c, today)) {
    days[date] = scoreDay(c, weights, (habitId) => done(date, habitId))
  }
  return days
}

/** 0-based period containing `date`; -1 outside the challenge. */
export function periodOf(c: Challenge, date: string): number {
  const i = dayIndex(c, date)
  if (i < 0) return -1
  if (c.periodDays === 0) return 0
  return Math.floor(i / c.periodDays)
}

export function currentPeriod(c: Challenge, today: string): number {
  // Before it starts, the first period is the one worth showing; after it ends,
  // the last one — so the board always has something to display.
  if (today < c.startDate) return 0
  if (today > c.endDate) return periodOf(c, c.endDate)
  return periodOf(c, today)
}

export function periodCount(c: Challenge): number {
  if (c.periodDays === 0) return 1
  return Math.ceil(challengeLength(c) / c.periodDays)
}

/**
 * The date window for a period, clipped to the challenge so the last one never
 * advertises days past the finish date.
 */
export function periodRange(c: Challenge, index: number): { start: string; end: string; label: string } {
  if (c.periodDays === 0) {
    return { start: c.startDate, end: c.endDate, label: 'All time' }
  }
  const start = addDays(c.startDate, index * c.periodDays)
  const rawEnd = addDays(start, c.periodDays - 1)
  const end = rawEnd > c.endDate ? c.endDate : rawEnd
  const label = c.periodDays === 7 ? `Week ${index + 1}` : `Month ${index + 1}`
  return { start, end, label }
}

function inRange(date: string, from?: string, to?: string): boolean {
  if (from !== undefined && date < from) return false
  if (to !== undefined && date > to) return false
  return true
}

export function sumPoints(days: ScoreDays, from?: string, to?: string): number {
  let total = 0
  for (const [date, score] of Object.entries(days)) {
    if (inRange(date, from, to)) total += score.points
  }
  return total
}

/** Days where every committed habit was completed. */
export function perfectDays(days: ScoreDays, from?: string, to?: string): number {
  let count = 0
  for (const [date, score] of Object.entries(days)) {
    if (inRange(date, from, to) && score.total > 0 && score.done === score.total) count++
  }
  return count
}

/** Days with any activity at all — used for the "has this person shown up" read. */
export function daysLogged(days: ScoreDays, from?: string, to?: string): number {
  let count = 0
  for (const [date, score] of Object.entries(days)) {
    if (inRange(date, from, to) && score.done > 0) count++
  }
  return count
}

export type BoardMember = {
  displayName: string
  joinedAt: number
  leftAt?: number
}

export type StandingRow = {
  uid: string
  displayName: string
  points: number
  perfect: number
  daysLogged: number
  /** Epoch ms of that member's last score write; null if they never wrote one. */
  updatedAt: number | null
  isSelf: boolean
  hasLeft: boolean
}

/**
 * The leaderboard, highest first.
 *
 * Ties break on perfect days, then on who joined first, then on uid. That last
 * step looks like overkill but it is the point: without a total order the board
 * would settle into whatever sequence Firestore happened to deliver, and two
 * friends looking at the same tie would see different rankings.
 */
export function standings(
  members: Record<string, BoardMember>,
  scores: Record<string, { days: ScoreDays; updatedAt?: number }>,
  selfUid: string | null,
  range: { from: string; to: string } | null,
): StandingRow[] {
  // Union of both sides. A member who has never logged still belongs on the
  // board at zero, and a score document whose member doc hasn't arrived yet
  // (a join still in flight) must not crash the render.
  const uids = new Set([...Object.keys(members), ...Object.keys(scores)])
  const from = range?.from
  const to = range?.to

  const rows: StandingRow[] = Array.from(uids, (uid) => {
    const member = members[uid]
    const entry = scores[uid]
    const days = entry?.days ?? {}
    return {
      uid,
      displayName: member?.displayName ?? 'Someone',
      points: sumPoints(days, from, to),
      perfect: perfectDays(days, from, to),
      daysLogged: daysLogged(days, from, to),
      updatedAt: entry?.updatedAt ?? null,
      isSelf: selfUid !== null && uid === selfUid,
      hasLeft: member?.leftAt !== undefined,
    }
  })

  rows.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    if (b.perfect !== a.perfect) return b.perfect - a.perfect
    const aJoined = members[a.uid]?.joinedAt ?? Number.MAX_SAFE_INTEGER
    const bJoined = members[b.uid]?.joinedAt ?? Number.MAX_SAFE_INTEGER
    if (aJoined !== bJoined) return aJoined - bJoined
    return a.uid < b.uid ? -1 : 1
  })

  return rows
}

/** 1-based position of `uid` on the board, or 0 when they aren't on it. */
export function rankOf(rows: StandingRow[], uid: string | null): number {
  if (!uid) return 0
  const i = rows.findIndex((r) => r.uid === uid)
  return i < 0 ? 0 : i + 1
}

/** Whether the challenge is running on `today` (not finished, not archived). */
export function isActive(c: Challenge, today: string): boolean {
  return !c.archived && today <= c.endDate
}

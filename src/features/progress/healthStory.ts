// "What actually changed" — the layer that turns 48 metrics into a few sentences.
//
// Deliberately NOT a composite score. Whoop's Recovery and Oura's Readiness are
// weighted blends tuned on millions of nights; inventing our own weights would
// produce a confident number with nothing behind it. Worse, composites are
// compensatory — a good HRV can cancel out three hours of sleep and the score
// looks fine.
//
// Instead every metric is judged against its OWN history, and the app speaks only
// when several related metrics agree. That is the primitive every serious app
// converged on: compare a fast average to a slow average of the same measurement
// (Apple 90d vs 365d, Oura 14d vs 3mo, Garmin acute vs chronic load) and say
// something only when they diverge.
//
// The two-metric rule matters more than it looks. Reacting to single noisy
// readings is worse than doing nothing: clinical alarm studies put false-alarm
// rates at 72-99%, and the documented result is that people switch the alarms off
// and then miss the real event. A section that cries wolf gets ignored, which is
// the exact failure we are fixing.

import type { HealthDay } from '../../types'
import { familyFor, formatMetric, metricMeta } from '../../lib/healthMetrics'
import { healthDaysDesc } from '../../store/health'
import { todayISO } from '../../lib/date'
import { typicalRangeOf } from './healthTrends'

export type StoryTheme = 'recovery' | 'sleep' | 'activity' | 'fitness'

export const THEME_LABELS: Record<StoryTheme, string> = {
  recovery: 'Recovery',
  sleep: 'Sleep',
  activity: 'Activity',
  fitness: 'Fitness',
}

export type StoryMetric = {
  key: string
  theme: StoryTheme
  /**
   * Smallest change worth reporting, in the metric's own units.
   *
   * The typical-range test alone is not enough. A metric that barely moves gets a
   * very tight band, so a trivial wobble lands outside it and gets announced —
   * that is how "Respiration 1 brpm below your usual" and "Fitness age 0.2 yr
   * above usual" happened. Both cleared the band; neither means anything. A shift
   * must now clear the band AND be big enough to matter.
   */
  minDelta: number
  /**
   * True for metrics that accumulate through the day (steps, calories, active
   * minutes). Today is excluded for these: at 9am you have 496 of the 17,000
   * steps you will finish with, and averaging that partial day in makes activity
   * look like it collapsed every single morning.
   */
  cumulative?: boolean
}

/**
 * The metrics worth telling a story about, and which story they belong to.
 *
 * A curated list, not everything we import: a drift in bone mass or floors
 * climbed is real but it is not news, and including it would bury the readings
 * that are. Whether a rise is good or bad comes from the catalog's
 * `lowerIsBetter`, so it stays defined in exactly one place.
 *
 * Two kinds of metric are deliberately absent:
 *
 *   Respiration — a breathing rate that moves 1-2 brpm tells you nothing
 *   actionable, and at that resolution it is mostly sensor variation.
 *
 *   Endurance score — it drifts continuously rather than settling, so it has no
 *   "usual" for a reading to be outside of. Comparing it to its own baseline
 *   produces a verdict on noise.
 *
 * Both are still imported, still charted, still in the metric grid. They just do
 * not get to make claims.
 */
export const STORY_METRICS: StoryMetric[] = [
  { key: 'restingHr', theme: 'recovery', minDelta: 2 },
  { key: 'hrv', theme: 'recovery', minDelta: 5 },
  { key: 'bodyBattery', theme: 'recovery', minDelta: 5 },
  { key: 'stress', theme: 'recovery', minDelta: 5 },
  { key: 'spo2', theme: 'recovery', minDelta: 2 },

  { key: 'sleepMinutes', theme: 'sleep', minDelta: 20 },
  { key: 'sleepScore', theme: 'sleep', minDelta: 5 },
  { key: 'deepSleepMinutes', theme: 'sleep', minDelta: 15 },
  { key: 'remSleepMinutes', theme: 'sleep', minDelta: 15 },
  { key: 'awakeMinutes', theme: 'sleep', minDelta: 15 },

  { key: 'steps', theme: 'activity', minDelta: 1500, cumulative: true },
  { key: 'intensityMinutes', theme: 'activity', minDelta: 10, cumulative: true },
  { key: 'activeCalories', theme: 'activity', minDelta: 150, cumulative: true },

  { key: 'vo2max', theme: 'fitness', minDelta: 1 },
  { key: 'trainingReadiness', theme: 'fitness', minDelta: 8 },
  // Garmin moves fitness age in half- and whole-year steps. Averaging a step
  // function produces fractional drift, so anything under half a year is an
  // artefact of the averaging rather than a change in fitness.
  { key: 'fitnessAge', theme: 'fitness', minDelta: 0.5 },
  { key: 'raceTime5k', theme: 'fitness', minDelta: 30 },
]

export type StoryWindows = {
  /** Days in the recent window. */
  fast: number
  /** Days in the baseline window, measured back from the end of the fast one. */
  slow: number
}

export const DEFAULT_WINDOWS: StoryWindows = { fast: 7, slow: 28 }

/** Fewest readings needed in each window before a comparison means anything. */
const MIN_FAST = 3
const MIN_SLOW = 6

export type Shift = {
  key: string
  label: string
  theme: StoryTheme
  /** Mean over the recent window. */
  fast: number
  /** Mean over the baseline window. */
  slow: number
  delta: number
  /** True when the move is in the direction the user wants. */
  improving: boolean
  /** Plain-language summary, e.g. "4 bpm above your usual". */
  note: string
}

/**
 * Recent mean vs baseline mean for one metric, or null when it has not moved
 * enough to be worth mentioning.
 *
 * The windows do not overlap. Comparing the last 7 days against a 28-day average
 * that CONTAINS those 7 days damps the very signal being looked for — the recent
 * days pull the baseline toward themselves, so a real shift looks smaller than it
 * is. Here the baseline is the 28 days that came before.
 *
 * Significance is the metric's own spread, never a fixed percentage: the recent
 * mean has to land outside the middle 70% of the baseline's own readings. A
 * metric that swings wildly (steps) therefore needs a big move to speak up, while
 * a stable one (resting HR) needs only a small one — which is the correct
 * behaviour and requires no per-metric tuning.
 */
export function metricShift(
  daysDesc: HealthDay[],
  metric: StoryMetric,
  windows: StoryWindows = DEFAULT_WINDOWS,
  today: string = todayISO(),
): Shift | null {
  const { key, theme } = metric
  const fastVals: number[] = []
  const slowVals: number[] = []
  let seen = 0

  for (const day of daysDesc) {
    // A cumulative metric's today is a part-day: at 9am it holds 496 of the
    // 17,000 steps that day will end on. Averaging that in makes every morning
    // look like a collapse in activity, so the day is skipped until it is over.
    if (metric.cumulative && day.date >= today) continue
    const v = day.metrics[key]
    if (typeof v !== 'number' || !Number.isFinite(v)) continue
    seen += 1
    if (seen <= windows.fast) fastVals.push(v)
    else if (seen <= windows.fast + windows.slow) slowVals.push(v)
    else break
  }

  if (fastVals.length < MIN_FAST || slowVals.length < MIN_SLOW) return null

  const band = typicalRangeOf(slowVals)
  if (!band) return null

  const fast = mean(fastVals)
  const slow = mean(slowVals)
  // Outside the metric's own normal range...
  if (fast >= band.low && fast <= band.high) return null

  const delta = fast - slow
  // ...and moved far enough to be worth a sentence. A near-constant metric has a
  // near-zero band, so the first test alone would announce every wobble.
  if (Math.abs(delta) < metric.minDelta) return null

  const meta = metricMeta(key)
  return {
    key,
    label: storyLabel(key),
    theme,
    fast,
    slow,
    delta,
    improving: meta.lowerIsBetter ? delta < 0 : delta > 0,
    note: `${formatMetric(key, Math.abs(delta))} ${delta > 0 ? 'above' : 'below'} your usual`,
  }
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length
}

/**
 * How to name a metric in a sentence. A family's headline metric takes the family
 * name: the catalog calls it "Stress (avg)" to distinguish it from "Stress (max)"
 * when both were tiles, but in prose the qualifier is noise — "Stress is up" is
 * what a person would say.
 */
function storyLabel(key: string): string {
  const family = familyFor(key)
  return family && family.primary === key ? family.label : metricMeta(key).label
}

/** Every storyworthy metric that has genuinely moved, biggest relative move first. */
export function healthShifts(
  days: Record<string, HealthDay>,
  windows: StoryWindows = DEFAULT_WINDOWS,
  today: string = todayISO(),
): Shift[] {
  const desc = healthDaysDesc(days)
  const out: Shift[] = []
  for (const metric of STORY_METRICS) {
    const shift = metricShift(desc, metric, windows, today)
    if (shift) out.push(shift)
  }
  // Rank by relative size so a 4bpm resting-HR move outranks a 300-step one.
  return out.sort((a, b) => relativeSize(b) - relativeSize(a))
}

function relativeSize(s: Shift): number {
  return s.slow !== 0 ? Math.abs(s.delta / s.slow) : 0
}

export type ThemeStory = {
  theme: StoryTheme
  label: string
  /** True when the agreeing metrics are moving the way the user wants. */
  improving: boolean
  /** The metrics that agree, and so earned this headline. */
  shifts: Shift[]
  headline: string
}

export type HealthStory = {
  /** Themes where at least two metrics agree — the part worth reading. */
  stories: ThemeStory[]
  /** Metrics that moved but did not form a theme. Shown quietly, if at all. */
  looseEnds: Shift[]
}

/** Fewest agreeing metrics before a theme is allowed to make a claim. */
export const MIN_AGREEING = 2

/**
 * Group shifts into themes, and let a theme speak only when at least two of its
 * metrics moved the same way.
 *
 * One metric moving is noise often enough that acting on it is worse than
 * ignoring it; two related metrics moving together is a signal. Anything that
 * does not clear the bar is kept as a loose end rather than thrown away, so the
 * data is still there for anyone who wants it.
 */
export function healthStory(
  days: Record<string, HealthDay>,
  windows: StoryWindows = DEFAULT_WINDOWS,
  today: string = todayISO(),
): HealthStory {
  const shifts = healthShifts(days, windows, today)
  const byTheme = new Map<StoryTheme, Shift[]>()
  for (const s of shifts) {
    const arr = byTheme.get(s.theme) ?? []
    arr.push(s)
    byTheme.set(s.theme, arr)
  }

  const stories: ThemeStory[] = []
  const looseEnds: Shift[] = []

  for (const [theme, group] of byTheme) {
    const improving = group.filter((s) => s.improving)
    const worsening = group.filter((s) => !s.improving)
    const winner = improving.length >= worsening.length ? improving : worsening
    // A theme pulling in both directions at once is not a story — it is two
    // observations, and asserting either would misrepresent the other.
    if (winner.length < MIN_AGREEING || winner.length === group.length / 2) {
      looseEnds.push(...group)
      continue
    }
    const isImproving = winner === improving
    stories.push({
      theme,
      label: THEME_LABELS[theme],
      improving: isImproving,
      shifts: winner,
      headline: headlineFor(theme, isImproving, winner),
    })
    looseEnds.push(...group.filter((s) => !winner.includes(s)))
  }

  // Strongest story first, measured by how many metrics back it.
  stories.sort((a, b) => b.shifts.length - a.shifts.length)
  return { stories, looseEnds }
}

/**
 * A sentence describing what moved. Deliberately observational — it says what the
 * numbers did and names them, and never diagnoses or prescribes. We are not
 * qualified to tell someone they are overtrained or getting ill, and a wrong
 * verdict stated confidently is worse than a right one left unsaid.
 */
function headlineFor(theme: StoryTheme, improving: boolean, shifts: Shift[]): string {
  const names = listNames(shifts.map((s) => s.label))
  switch (theme) {
    case 'recovery':
      return improving
        ? `Your recovery is trending up — ${names} have improved on your usual.`
        : `Your recovery is trending down — ${names} have moved the wrong way.`
    case 'sleep':
      return improving
        ? `You have been sleeping better — ${names} are up on your usual.`
        : `You have been sleeping worse — ${names} are down on your usual.`
    case 'activity':
      return improving
        ? `You have been more active than usual — ${names} are up.`
        : `You have been less active than usual — ${names} are down.`
    case 'fitness':
      return improving
        ? `Your fitness is improving — ${names} have moved in your favour.`
        : `Your fitness has slipped — ${names} have moved against you.`
  }
}

/** "A, B and C" */
function listNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

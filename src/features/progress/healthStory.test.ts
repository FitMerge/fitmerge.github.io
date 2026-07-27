import { describe, expect, it } from 'vitest'
import { healthDaysDesc } from '../../store/health'
import {
  DEFAULT_WINDOWS,
  MIN_AGREEING,
  STORY_METRICS,
  healthShifts,
  healthStory,
  metricShift,
} from './healthStory'
import { metricMeta } from '../../lib/healthMetrics'
import type { HealthDay } from '../../types'

/** Look up a story metric by key, so tests exercise the real thresholds. */
const M = (key: string) => STORY_METRICS.find((m) => m.key === key)!

/**
 * Build a day-map ending today, newest day = index 0. `series[k]` supplies a value
 * per day-ago index; a function lets a test shape fast vs slow windows precisely.
 */
function buildDays(
  n: number,
  series: Record<string, (daysAgo: number) => number | undefined>,
): Record<string, HealthDay> {
  const days: Record<string, HealthDay> = {}
  const end = new Date(2026, 6, 27)
  for (let i = 0; i < n; i++) {
    const d = new Date(end)
    d.setDate(d.getDate() - i)
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const metrics: Record<string, number> = {}
    for (const [key, fn] of Object.entries(series)) {
      const v = fn(i)
      if (v !== undefined) metrics[key] = v
    }
    days[iso] = { date: iso, metrics }
  }
  return days
}

/** A metric that is flat at `base`, with a tiny alternating wobble for spread. */
const flat = (base: number) => (i: number) => base + (i % 2 === 0 ? 0.5 : -0.5)
/** Flat at `base`, except the most recent `fast` days sit at `shifted`. */
const shifts = (base: number, shifted: number, fast = DEFAULT_WINDOWS.fast) =>
  (i: number) => (i < fast ? shifted : base + (i % 2 === 0 ? 0.5 : -0.5))

describe('STORY_METRICS', () => {
  it('only names metrics the catalog knows', () => {
    for (const { key } of STORY_METRICS) {
      expect(metricMeta(key).order, `${key} is not in the catalog`).toBeLessThan(100)
    }
  })

  it('lists each metric once', () => {
    const keys = STORY_METRICS.map((m) => m.key)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('metricShift', () => {
  const desc = (days: Record<string, HealthDay>) => healthDaysDesc(days)

  it('says nothing when the metric has not moved', () => {
    const days = buildDays(40, { restingHr: flat(54) })
    expect(metricShift(desc(days), M('restingHr'))).toBeNull()
  })

  it('reports a real shift against the baseline', () => {
    const days = buildDays(40, { restingHr: shifts(54, 60) })
    const shift = metricShift(desc(days), M('restingHr'))!
    expect(shift.fast).toBeCloseTo(60, 6)
    expect(shift.slow).toBeCloseTo(54, 1)
    expect(shift.delta).toBeCloseTo(6, 1)
  })

  it('knows which direction is good for the metric', () => {
    const up = metricShift(desc(buildDays(40, { restingHr: shifts(54, 60) })), M('restingHr'))!
    const down = metricShift(desc(buildDays(40, { restingHr: shifts(54, 48) })), M('restingHr'))!
    // Resting HR is lowerIsBetter, so up is bad and down is good.
    expect(up.improving).toBe(false)
    expect(down.improving).toBe(true)

    const hrvUp = metricShift(desc(buildDays(40, { hrv: shifts(60, 75) })), M('hrv'))!
    expect(hrvUp.improving).toBe(true)
  })

  it('excludes the recent window from the baseline it is compared against', () => {
    // If the last 7 days leaked into the 28-day baseline they would drag it up and
    // the reported delta would come out smaller than the true 6 bpm move.
    const shift = metricShift(desc(buildDays(40, { restingHr: shifts(54, 60) })), M('restingHr'))!
    expect(shift.slow).toBeLessThan(55)
    expect(shift.delta).toBeGreaterThan(5)
  })

  it('needs a noisy metric to move further than a stable one', () => {
    // Steps swinging 6000-14000 should ignore a move a resting HR would flag.
    const noisy = buildDays(40, {
      steps: (i) => (i < 7 ? 10600 : 10000 + ((i * 3739) % 4000) - 2000),
    })
    expect(metricShift(desc(noisy), M('steps'))).toBeNull()

    const stable = buildDays(40, { restingHr: shifts(54, 57) })
    expect(metricShift(desc(stable), M('restingHr'))).not.toBeNull()
  })

  it('stays silent until there is enough history', () => {
    const thin = buildDays(8, { restingHr: shifts(54, 60) })
    expect(metricShift(desc(thin), M('restingHr'))).toBeNull()
  })

  it('ignores days where the metric is missing rather than treating them as zero', () => {
    const gappy = buildDays(60, {
      restingHr: (i) => (i % 3 === 0 ? undefined : i < 10 ? 60 : 54),
    })
    const shift = metricShift(desc(gappy), M('restingHr'))
    expect(shift).not.toBeNull()
    expect(shift!.slow).toBeCloseTo(54, 1)
  })
})

describe('healthStory', () => {
  it('says nothing at all when nothing changed', () => {
    const days = buildDays(40, { restingHr: flat(54), hrv: flat(60), sleepMinutes: flat(420) })
    const story = healthStory(days)
    expect(story.stories).toEqual([])
    expect(story.looseEnds).toEqual([])
  })

  it('refuses to headline a single metric moving on its own', () => {
    const days = buildDays(40, { restingHr: shifts(54, 62), hrv: flat(60) })
    const story = healthStory(days)
    expect(story.stories).toEqual([])
    // Kept, not discarded — it just does not get to make a claim.
    expect(story.looseEnds.map((s) => s.key)).toEqual(['restingHr'])
  })

  it('speaks when two metrics in a theme agree', () => {
    const days = buildDays(40, { restingHr: shifts(54, 60), hrv: shifts(60, 48) })
    const story = healthStory(days)
    expect(story.stories).toHaveLength(1)
    const [s] = story.stories
    expect(s.theme).toBe('recovery')
    expect(s.improving).toBe(false)
    expect(s.shifts).toHaveLength(2)
    expect(s.headline).toContain('recovery is trending down')
  })

  it('needs exactly MIN_AGREEING metrics, not fewer', () => {
    expect(MIN_AGREEING).toBe(2)
    const one = healthStory(buildDays(40, { restingHr: shifts(54, 60) }))
    expect(one.stories).toHaveLength(0)
  })

  it('reports an improvement as an improvement', () => {
    const days = buildDays(40, { restingHr: shifts(54, 48), hrv: shifts(60, 76) })
    const [s] = healthStory(days).stories
    expect(s.improving).toBe(true)
    expect(s.headline).toContain('recovery is trending up')
  })

  it('will not claim a direction when a theme is split evenly', () => {
    // One better, one worse: two observations, not a story.
    const days = buildDays(40, { restingHr: shifts(54, 48), hrv: shifts(60, 48) })
    const story = healthStory(days)
    expect(story.stories).toEqual([])
    expect(story.looseEnds).toHaveLength(2)
  })

  it('separates themes rather than blending them into one verdict', () => {
    const days = buildDays(40, {
      restingHr: shifts(54, 60),
      hrv: shifts(60, 48),
      steps: shifts(10000, 15000),
      activeCalories: shifts(600, 900),
    })
    const story = healthStory(days)
    expect(story.stories.map((s) => s.theme).sort()).toEqual(['activity', 'recovery'])
    // Sleep said nothing because sleep did not move — no filler.
    expect(story.stories.every((s) => s.shifts.length >= MIN_AGREEING)).toBe(true)
  })

  it('names the metrics behind every headline', () => {
    const days = buildDays(40, { restingHr: shifts(54, 60), hrv: shifts(60, 48) })
    const [s] = healthStory(days).stories
    for (const shift of s.shifts) expect(s.headline).toContain(shift.label)
  })

  it('never diagnoses or prescribes', () => {
    const days = buildDays(40, { restingHr: shifts(54, 62), hrv: shifts(60, 44) })
    const [s] = healthStory(days).stories
    for (const word of ['overtrain', 'illness', 'sick', 'should', 'must', 'rest day']) {
      expect(s.headline.toLowerCase()).not.toContain(word)
    }
  })
})

describe('healthShifts', () => {
  it('ranks a big relative move above a small one', () => {
    const days = buildDays(40, {
      restingHr: shifts(54, 56), // ~4%
      hrv: shifts(60, 90), // ~50%
    })
    const [first] = healthShifts(days)
    expect(first.key).toBe('hrv')
  })

  it('returns nothing for an empty log', () => {
    expect(healthShifts({})).toEqual([])
  })
})

describe('guardrails against meaningless findings', () => {
  const desc = (days: Record<string, HealthDay>) => healthDaysDesc(days)
  const TODAY = '2026-07-27'

  it('ignores today for a metric that accumulates through the day', () => {
    // Reported: "Steps 7,323 — 6,397 below your usual" at 9am on a day with 496
    // steps so far, after a 17,000-step yesterday. The part-day dragged the
    // 7-day mean down, so activity looked like it collapsed every morning.
    const days = buildDays(40, { steps: (i) => (i === 0 ? 496 : 17000 + (i % 2 ? 200 : -200)) })
    expect(metricShift(desc(days), M('steps'), DEFAULT_WINDOWS, TODAY)).toBeNull()

    // And to be sure the case is real: including that part-day WOULD fire.
    const withPartDay = healthDaysDesc(days)
    const fastIncludingToday =
      withPartDay.slice(0, 7).reduce((sum, d) => sum + (d.metrics.steps ?? 0), 0) / 7
    expect(Math.abs(fastIncludingToday - 17000)).toBeGreaterThan(M('steps').minDelta)
  })

  it('still reports a real drop in a cumulative metric once days are complete', () => {
    const days = buildDays(40, {
      steps: (i) => (i === 0 ? 496 : i <= 7 ? 5000 : 12000 + ((i * 977) % 2000) - 1000),
    })
    const shift = metricShift(desc(days), M('steps'), DEFAULT_WINDOWS, TODAY)!
    expect(shift.improving).toBe(false)
    // Today's part-day is excluded, so the average reflects finished days only.
    expect(shift.fast).toBeCloseTo(5000, 0)
  })

  it('does not treat a part-day as a collapse for any cumulative metric', () => {
    for (const key of ['steps', 'activeCalories', 'intensityMinutes']) {
      const metric = M(key)
      expect(metric.cumulative, key).toBe(true)
      const base = metric.minDelta * 20
      const days = buildDays(40, { [key]: (i) => (i === 0 ? 1 : base + ((i * 7) % 3) - 1) })
      expect(metricShift(desc(days), metric, DEFAULT_WINDOWS, TODAY), key).toBeNull()
    }
  })

  it('will not call a fractional fitness-age drift a change', () => {
    // Reported: "Fitness age 0.2 yr above usual". Garmin moves it in half-year
    // steps, so a fractional delta is an artefact of averaging a step function.
    const days = buildDays(40, { fitnessAge: (i) => (i < 7 ? 34.2 : 34.0) })
    expect(metricShift(desc(days), M('fitnessAge'), DEFAULT_WINDOWS, TODAY)).toBeNull()
  })

  it('does report fitness age when it moves a real step', () => {
    const days = buildDays(40, { fitnessAge: (i) => (i < 7 ? 33.0 : 34.0) })
    const shift = metricShift(desc(days), M('fitnessAge'), DEFAULT_WINDOWS, TODAY)!
    expect(shift.improving).toBe(true)
  })

  it('gives every story metric a floor big enough to matter', () => {
    for (const m of STORY_METRICS) {
      expect(m.minDelta, m.key).toBeGreaterThan(0)
    }
  })

  it('drops the metrics that cannot support a verdict', () => {
    const keys = STORY_METRICS.map((m) => m.key)
    // Respiration moves 1-2 brpm, which is sensor variation, not news.
    expect(keys).not.toContain('respiration')
    // Endurance score drifts continuously, so it has no "usual" to be outside of.
    expect(keys).not.toContain('enduranceScore')
  })

  it('keeps a near-constant metric from announcing every wobble', () => {
    // A tight baseline gives a tight band, so the band test alone always fires.
    const days = buildDays(40, { hrv: (i) => (i < 7 ? 61 : 60) })
    expect(metricShift(desc(days), M('hrv'), DEFAULT_WINDOWS, TODAY)).toBeNull()
  })
})

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
    expect(metricShift(desc(days), 'restingHr', 'recovery')).toBeNull()
  })

  it('reports a real shift against the baseline', () => {
    const days = buildDays(40, { restingHr: shifts(54, 60) })
    const shift = metricShift(desc(days), 'restingHr', 'recovery')!
    expect(shift.fast).toBeCloseTo(60, 6)
    expect(shift.slow).toBeCloseTo(54, 1)
    expect(shift.delta).toBeCloseTo(6, 1)
  })

  it('knows which direction is good for the metric', () => {
    const up = metricShift(desc(buildDays(40, { restingHr: shifts(54, 60) })), 'restingHr', 'recovery')!
    const down = metricShift(desc(buildDays(40, { restingHr: shifts(54, 48) })), 'restingHr', 'recovery')!
    // Resting HR is lowerIsBetter, so up is bad and down is good.
    expect(up.improving).toBe(false)
    expect(down.improving).toBe(true)

    const hrvUp = metricShift(desc(buildDays(40, { hrv: shifts(60, 75) })), 'hrv', 'recovery')!
    expect(hrvUp.improving).toBe(true)
  })

  it('excludes the recent window from the baseline it is compared against', () => {
    // If the last 7 days leaked into the 28-day baseline they would drag it up and
    // the reported delta would come out smaller than the true 6 bpm move.
    const shift = metricShift(desc(buildDays(40, { restingHr: shifts(54, 60) })), 'restingHr', 'recovery')!
    expect(shift.slow).toBeLessThan(55)
    expect(shift.delta).toBeGreaterThan(5)
  })

  it('needs a noisy metric to move further than a stable one', () => {
    // Steps swinging 6000-14000 should ignore a move a resting HR would flag.
    const noisy = buildDays(40, {
      steps: (i) => (i < 7 ? 10600 : 10000 + ((i * 3739) % 4000) - 2000),
    })
    expect(metricShift(desc(noisy), 'steps', 'activity')).toBeNull()

    const stable = buildDays(40, { restingHr: shifts(54, 57) })
    expect(metricShift(desc(stable), 'restingHr', 'recovery')).not.toBeNull()
  })

  it('stays silent until there is enough history', () => {
    const thin = buildDays(8, { restingHr: shifts(54, 60) })
    expect(metricShift(desc(thin), 'restingHr', 'recovery')).toBeNull()
  })

  it('ignores days where the metric is missing rather than treating them as zero', () => {
    const gappy = buildDays(60, {
      restingHr: (i) => (i % 3 === 0 ? undefined : i < 10 ? 60 : 54),
    })
    const shift = metricShift(desc(gappy), 'restingHr', 'recovery')
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

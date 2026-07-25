import { describe, expect, it } from 'vitest'
import type { GarminRecord, WorkoutSession } from '../../types'
import {
  bestPerformance,
  confidenceFor,
  estimateFitness,
  fractionOfMax,
  riegel,
  trainingPaces,
  vdot,
  velocityAtVo2,
  vo2AtVelocity,
} from './racePrediction'

const TODAY = '2026-07-24'

function run(date: string, distanceKm: number, durationMin: number, extra: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    id: `${date}-${distanceKm}`,
    name: 'Denver Running',
    date,
    startedAt: 0,
    finishedAt: 1,
    entries: [],
    durationMin,
    distanceKm,
    ...extra,
  }
}

describe('riegel', () => {
  it('returns the same time for the same distance', () => {
    expect(riegel(5, 25, 5)).toBeCloseTo(25, 6)
  })

  it('predicts a slower pace over a longer distance', () => {
    // A 25:00 5K predicts roughly 52 minutes for 10K — slower than a doubled 50:00.
    const tenK = riegel(5, 25, 10)
    expect(tenK).toBeGreaterThan(50)
    expect(tenK).toBeCloseTo(25 * Math.pow(2, 1.06), 6)
  })

  it('predicts a faster pace over a shorter distance', () => {
    expect(riegel(10, 50, 5)).toBeLessThan(25)
  })

  it('refuses to invent a time from nonsense input', () => {
    expect(riegel(0, 25, 10)).toBe(0)
    expect(riegel(5, 0, 10)).toBe(0)
    expect(riegel(5, 25, 0)).toBe(0)
  })
})

describe('daniels equations', () => {
  it('inverts velocity and oxygen cost consistently', () => {
    for (const v of [180, 240, 300, 380]) {
      expect(velocityAtVo2(vo2AtVelocity(v))).toBeCloseTo(v, 4)
    }
  })

  it('sustains a falling fraction of VO2max as the effort lengthens', () => {
    const short = fractionOfMax(10)
    const medium = fractionOfMax(60)
    const long = fractionOfMax(180)
    expect(short).toBeGreaterThan(medium)
    expect(medium).toBeGreaterThan(long)
    // Bounded by the model: near 1.0 for a short race, tending to 0.8 for a long one.
    expect(short).toBeLessThan(1.02)
    expect(long).toBeGreaterThan(0.79)
  })

  it('puts a 20:00 5K in the published VDOT band', () => {
    // Daniels' tables give VDOT ~49-50 for a 20-minute 5K.
    const v = vdot(5, 20)
    expect(v).not.toBeNull()
    expect(v as number).toBeGreaterThan(48)
    expect(v as number).toBeLessThan(51)
  })

  it('rates a faster run higher', () => {
    expect(vdot(5, 20) as number).toBeGreaterThan(vdot(5, 25) as number)
  })

  it('returns null rather than a number for impossible input', () => {
    expect(vdot(0, 20)).toBeNull()
    expect(vdot(5, 0)).toBeNull()
  })
})

describe('trainingPaces', () => {
  const paces = trainingPaces(50, 'metric')

  it('orders every band fast bound before slow bound', () => {
    for (const p of paces) expect(p.fastMin).toBeLessThan(p.slowMin)
  })

  it('orders the bands from easy to fast', () => {
    const easy = paces.find((p) => p.key === 'easy')!
    const threshold = paces.find((p) => p.key === 'threshold')!
    const repetition = paces.find((p) => p.key === 'repetition')!
    expect(easy.fastMin).toBeGreaterThan(threshold.fastMin)
    expect(threshold.fastMin).toBeGreaterThan(repetition.fastMin)
  })

  it('puts threshold pace for VDOT 50 near 4:15/km', () => {
    const threshold = paces.find((p) => p.key === 'threshold')!
    expect(threshold.fastMin).toBeGreaterThan(3.8)
    expect(threshold.slowMin).toBeLessThan(4.6)
  })

  it('reports a slower number per mile than per kilometre', () => {
    const metric = trainingPaces(50, 'metric').find((p) => p.key === 'easy')!
    const imperial = trainingPaces(50, 'imperial').find((p) => p.key === 'easy')!
    expect(imperial.fastMin).toBeGreaterThan(metric.fastMin)
    expect(imperial.fastMin / metric.fastMin).toBeCloseTo(1.60934, 3)
  })
})

describe('confidenceFor', () => {
  it('is confident close to the reference distance', () => {
    expect(confidenceFor(5, 10)).toBe('high')
    expect(confidenceFor(10, 5)).toBe('high')
    expect(confidenceFor(5, 5)).toBe('high')
  })

  it('softens as the gap widens', () => {
    expect(confidenceFor(5, 20)).toBe('moderate')
    expect(confidenceFor(5, 42.195)).toBe('low')
    expect(confidenceFor(42.195, 5)).toBe('low')
  })
})

describe('bestPerformance', () => {
  it('prefers the stronger run even when it is slower per kilometre', () => {
    // A 1:35 half is a far better performance than a 25:00 5K, despite the
    // slower pace — which is exactly what pace-ranking would get wrong.
    const sessions = [run('2026-07-01', 5, 25), run('2026-07-10', 21.0975, 95)]
    expect(bestPerformance(sessions, { kind: 'all' }, TODAY)?.km).toBeCloseTo(21.0975, 4)
  })

  it('ignores runs too short to model', () => {
    expect(bestPerformance([run('2026-07-01', 0.4, 1.5)], { kind: 'all' }, TODAY)).toBeNull()
  })

  it('ignores non-running activities', () => {
    const ride = run('2026-07-01', 40, 80, { name: 'Denver Cycling', sportType: 'cycling' })
    expect(bestPerformance([ride], { kind: 'all' }, TODAY)).toBeNull()
  })

  it('honours the sport type over the display name', () => {
    // Named like a walk, keyed as a run: Garmin's key decides.
    const s = run('2026-07-01', 5, 25, { name: 'Evening Walk', sportType: 'treadmill_running' })
    expect(bestPerformance([s], { kind: 'all' }, TODAY)?.km).toBe(5)
  })

  it('respects the date range', () => {
    const sessions = [run('2026-01-01', 5, 20), run('2026-07-20', 5, 25)]
    const recent = bestPerformance(sessions, { kind: 'days', days: 30 }, TODAY)
    expect(recent?.date).toBe('2026-07-20')
  })

  it('returns null with nothing to go on', () => {
    expect(bestPerformance([], { kind: 'all' }, TODAY)).toBeNull()
  })

  it('ignores unfinished sessions', () => {
    const s = run('2026-07-01', 5, 25)
    delete s.finishedAt
    expect(bestPerformance([s], { kind: 'all' }, TODAY)).toBeNull()
  })
})

describe('estimateFitness', () => {
  const sessions = [run('2026-07-10', 10, 50)]
  const estimate = estimateFitness(sessions, 'metric', { kind: 'all' }, TODAY)!

  it('produces a prediction at every standard distance', () => {
    expect(estimate.predictions.map((p) => p.label)).toEqual([
      '1 mile',
      '5K',
      '10K',
      'Half',
      'Marathon',
    ])
  })

  it('predicts monotonically slower paces as the race lengthens', () => {
    const paces = estimate.predictions.map((p) => p.pace)
    for (let i = 1; i < paces.length; i += 1) expect(paces[i]).toBeGreaterThan(paces[i - 1])
  })

  it('returns the source performance unchanged at its own distance', () => {
    const tenK = estimate.predictions.find((p) => p.label === '10K')!
    expect(tenK.durationMin).toBeCloseTo(50, 6)
    expect(tenK.isSource).toBe(true)
  })

  it('marks only the source distance as the source', () => {
    expect(estimate.predictions.filter((p) => p.isSource)).toHaveLength(1)
  })

  it('degrades confidence away from the source', () => {
    const byLabel = Object.fromEntries(estimate.predictions.map((p) => [p.label, p.confidence]))
    expect(byLabel['10K']).toBe('high')
    expect(byLabel['5K']).toBe('high')
    // 21.1km is 2.11x the 10K it is predicted from — just past the confident band.
    expect(byLabel['Half']).toBe('moderate')
    // 42.2km is 4.2x — far enough out that a 10K says little about it.
    expect(byLabel['Marathon']).toBe('low')
    // And a mile is 6.2x shorter — a different energy system entirely.
    expect(byLabel['1 mile']).toBe('low')
  })

  it('reports the performance it is based on', () => {
    expect(estimate.source.date).toBe('2026-07-10')
    expect(estimate.source.label).toBe('10K')
    expect(estimate.source.durationMin).toBe(50)
  })

  it('includes training paces for the estimated VDOT', () => {
    expect(estimate.paces).toHaveLength(5)
    expect(estimate.paces.every((p) => p.fastMin > 0 && p.slowMin > 0)).toBe(true)
  })

  it('is null when there is no running to predict from', () => {
    expect(estimateFitness([], 'metric', { kind: 'all' }, TODAY)).toBeNull()
  })
})

describe('estimateFitness with Garmin personal records', () => {
  // A modest whole-session run, alongside a Garmin 5K record set inside a longer
  // one. The record is the better performance and should win.
  const sessions = [run('2026-07-10', 10, 55)]
  const records: GarminRecord[] = [
    { typeId: 3, label: 'Fastest 5K', kind: 'time', value: 1272, date: '2026-05-11' },
    { typeId: 7, label: 'Longest run', kind: 'distance', value: 24310, date: '2026-06-14' },
  ]

  it('prefers a Garmin record over a weaker session', () => {
    const estimate = estimateFitness(sessions, 'metric', { kind: 'all' }, TODAY, records)!
    expect(estimate.source.fromRecord).toBe(true)
    expect(estimate.source.km).toBe(5)
    expect(estimate.source.durationMin).toBeCloseTo(21.2, 4)
  })

  it('ignores distance records, which say nothing about speed', () => {
    // Only the 5K can be a source; the "longest run" has no time attached.
    const estimate = estimateFitness([], 'metric', { kind: 'all' }, TODAY, [records[1]])
    expect(estimate).toBeNull()
  })

  it('keeps the session when it is the stronger performance', () => {
    const strong = [run('2026-07-10', 10, 40)]
    const estimate = estimateFitness(strong, 'metric', { kind: 'all' }, TODAY, records)!
    expect(estimate.source.fromRecord).toBe(false)
    expect(estimate.source.km).toBe(10)
  })

  it('works from records alone, with no sessions at all', () => {
    const estimate = estimateFitness([], 'metric', { kind: 'all' }, TODAY, records)!
    expect(estimate.source.fromRecord).toBe(true)
    expect(estimate.predictions).toHaveLength(5)
  })

  it('skips a 1km record as too short to model', () => {
    const short: GarminRecord[] = [{ typeId: 1, label: 'Fastest 1 km', kind: 'time', value: 200 }]
    expect(estimateFitness([], 'metric', { kind: 'all' }, TODAY, short)).toBeNull()
  })
})

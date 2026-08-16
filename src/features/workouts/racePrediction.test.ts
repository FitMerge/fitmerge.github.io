import { describe, expect, it } from 'vitest'
import type { GarminRecord, HealthDay, WorkoutSession } from '../../types'
import {
  allPerformances,
  bestPerformance,
  sourceFor,
  confidenceFor,
  estimateFitness,
  fractionOfMax,
  riegel,
  trainingPaces,
  vdot,
  timeAtVdot,
  vdotTrend,
  garminFitness,
  garminVdotTrend,
  latestVo2max,
  vo2maxTrend,
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
    // Predicted back through the VDOT model, so equal within numeric round-trip.
    expect(tenK.durationMin).toBeCloseTo(50, 3)
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

  it('drops a record dated outside the selected range', () => {
    // A fast 5K from over a year ago has the highest VDOT and would win on an
    // all-time basis, but on a 90-day view it should not drive current predictions;
    // the recent long run becomes the source instead.
    const recent = [run('2026-07-10', 20, 100)]
    const stale: GarminRecord[] = [
      { typeId: 3, label: 'Fastest 5K', kind: 'time', value: 1100, date: '2025-06-01' },
    ]
    const estimate = estimateFitness(recent, 'metric', { kind: 'days', days: 90 }, TODAY, stale)!
    expect(estimate.source.fromRecord).toBe(false)
    expect(estimate.source.km).toBe(20)
  })

  it('keeps a record dated inside the selected range', () => {
    const sessions = [run('2026-07-10', 10, 55)]
    const fresh: GarminRecord[] = [
      { typeId: 3, label: 'Fastest 5K', kind: 'time', value: 1272, date: '2026-06-01' },
    ]
    const estimate = estimateFitness(sessions, 'metric', { kind: 'days', days: 90 }, TODAY, fresh)!
    expect(estimate.source.fromRecord).toBe(true)
    expect(estimate.source.km).toBe(5)
  })
})

describe('timeAtVdot', () => {
  it('round-trips against vdot', () => {
    for (const [km, min] of [[5, 20], [10, 43.5], [21.0975, 95]] as [number, number][]) {
      const v = vdot(km, min) as number
      expect(timeAtVdot(v, km)).toBeCloseTo(min, 3)
    }
  })

  it('predicts a slower time at a longer distance for the same fitness', () => {
    expect(timeAtVdot(50, 10)).toBeGreaterThan(2 * timeAtVdot(50, 5))
  })

  it('predicts a faster time for a fitter runner', () => {
    expect(timeAtVdot(60, 5)).toBeLessThan(timeAtVdot(45, 5))
  })
})

describe('vdotTrend', () => {
  const monthly = [
    run('2026-03-05', 10, 55),
    run('2026-03-20', 10, 52), // best of March
    // April deliberately empty
    run('2026-05-08', 10, 48),
  ]

  it('takes the best run of each period, not the average', () => {
    const trend = vdotTrend(monthly, { kind: 'all' }, TODAY)
    const march = trend.find((p) => p.key === '2026-03-01')!
    expect(march.vdot).toBeCloseTo(vdot(10, 52) as number, 6)
  })

  it('leaves an empty period as a gap rather than interpolating fitness', () => {
    const trend = vdotTrend(monthly, { kind: 'all' }, TODAY)
    expect(trend.map((p) => p.key)).toEqual(['2026-03-01', '2026-04-01', '2026-05-01'])
    expect(trend[1].vdot).toBeNull()
    expect(trend[1].predicted5k).toBeNull()
  })

  it('reports a predicted 5K alongside each VDOT', () => {
    const trend = vdotTrend(monthly, { kind: 'all' }, TODAY)
    const may = trend.find((p) => p.key === '2026-05-01')!
    expect(may.predicted5k).toBeCloseTo(timeAtVdot(may.vdot as number, 5), 6)
  })

  it('shows improvement as a rising VDOT', () => {
    const trend = vdotTrend(monthly, { kind: 'all' }, TODAY).filter((p) => p.vdot !== null)
    expect((trend[trend.length - 1].vdot as number)).toBeGreaterThan(trend[0].vdot as number)
  })

  it('buckets by week for a short range', () => {
    const trend = vdotTrend(
      [run('2026-07-06', 10, 50), run('2026-07-20', 10, 48)],
      { kind: 'days', days: 30 },
      TODAY,
    )
    // Monday-based weeks: Jul 6 and Jul 20 are two weeks apart, so three buckets.
    expect(trend).toHaveLength(3)
    expect(trend[0].key).toBe('2026-07-06')
  })

  it('is empty with nothing to measure', () => {
    expect(vdotTrend([], { kind: 'all' }, TODAY)).toEqual([])
  })
})

describe('allPerformances', () => {
  it('keeps every qualifying run, not just the best', () => {
    const runs = [run('2026-07-01', 5, 25), run('2026-07-08', 10, 52), run('2026-07-15', 21.0975, 115)]
    expect(allPerformances(runs, { kind: 'all' }, TODAY)).toHaveLength(3)
  })

  it('still drops sprints, non-runs and unfinished sessions', () => {
    const s = run('2026-07-01', 5, 25)
    delete s.finishedAt
    const runs = [
      run('2026-07-02', 0.4, 1.5),
      run('2026-07-03', 40, 80, { name: 'Cycling', sportType: 'cycling' }),
      s,
    ]
    expect(allPerformances(runs, { kind: 'all' }, TODAY)).toEqual([])
  })
})

describe('sourceFor', () => {
  const mile = { km: 1.61, durationMin: 6.05, date: '2025-09-23', name: 'Mile', vdot: 48, fromRecord: true }
  const tenK = { km: 10, durationMin: 52, date: '2026-07-08', name: '10K', vdot: 41, fromRecord: false }

  it('prefers a comparable effort over a stronger but distant one', () => {
    // The mile has the higher VDOT, but predicting a 10K from it is a 6x stretch.
    expect(sourceFor(10, [mile, tenK])).toBe(tenK)
  })

  it('still uses the strongest effort when both are comparable', () => {
    const fastTenK = { ...tenK, vdot: 45, name: 'fast' }
    expect(sourceFor(10, [tenK, fastTenK])).toBe(fastTenK)
  })

  it('picks the mile PR for the mile', () => {
    expect(sourceFor(1.61, [mile, tenK])).toBe(mile)
  })

  it('widens the search rather than giving up when nothing is close', () => {
    expect(sourceFor(42.195, [mile])).toBe(mile)
  })

  it('has no answer with no candidates', () => {
    expect(sourceFor(10, [])).toBeNull()
  })
})

describe('estimateFitness predicts every distance from one VDOT', () => {
  // A strong 1-mile PR next to real 5K, 10K and half running. The mile has the
  // highest VDOT, so it anchors every prediction — one fitness level, not a
  // different nearby run per distance (which could rank a mile slower than a 5K).
  const records: GarminRecord[] = [
    { typeId: 2, label: 'Fastest 1 mile', kind: 'time', value: 363, date: '2025-09-23' },
  ]
  const sessions = [
    run('2026-07-01', 5, 26),
    run('2026-07-08', 10, 54),
    run('2026-07-15', 21.0975, 120),
  ]
  const estimate = estimateFitness(sessions, 'imperial', { kind: 'all' }, TODAY, records)!

  it('anchors every prediction on the single strongest effort', () => {
    expect(estimate.predictions.every((p) => p.source.fromRecord)).toBe(true)
    expect(estimate.predictions.every((p) => Math.abs(p.source.km - 1.61) < 0.01)).toBe(true)
  })

  it('produces strictly monotonic paces — a mile is never slower than a 5K', () => {
    const paces = estimate.predictions.map((p) => p.pace)
    for (let i = 1; i < paces.length; i += 1) expect(paces[i]).toBeGreaterThan(paces[i - 1])
  })

  it('returns the anchor effort unchanged at its own distance', () => {
    const mile = estimate.predictions.find((p) => p.label === '1 mile')!
    expect(mile.isSource).toBe(true)
    expect(mile.durationMin).toBeCloseTo(363 / 60, 2)
  })

  it('rates distances near the anchor confidently and far ones low', () => {
    const byLabel = Object.fromEntries(estimate.predictions.map((p) => [p.label, p.confidence]))
    expect(byLabel['5K']).toBe('moderate') // 3.1x from a mile
    expect(byLabel['Marathon']).toBe('low') // 26x
  })

  it('keeps the headline on the strongest effort overall', () => {
    expect(estimate.source.fromRecord).toBe(true)
    expect(estimate.vdot).toBeGreaterThan(45)
  })

  it('reports a usable source note for every row', () => {
    for (const p of estimate.predictions) {
      expect(p.source.km).toBeGreaterThan(0)
      expect(typeof p.source.date).toBe('string')
    }
  })
})

describe("Garmin's own race predictor", () => {
  /** Newest-first health days carrying Garmin's predicted race times, in seconds. */
  const healthDays = (over: Record<string, number> = {}): HealthDay[] => [
    {
      date: '2026-07-26',
      metrics: {
        raceTime5k: 1272,
        raceTime10k: 2640,
        raceTimeHalf: 5820,
        raceTimeMarathon: 12300,
        ...over,
      },
    },
  ]

  it('reports each distance exactly as the watch gave it, not extrapolated', () => {
    const est = garminFitness(healthDays(), 'metric')!
    expect(est.origin).toBe('garmin')
    const byLabel = Object.fromEntries(est.predictions.map((p) => [p.label, p.durationMin]))
    expect(byLabel['5K']).toBeCloseTo(1272 / 60, 6)
    expect(byLabel['Marathon']).toBeCloseTo(12300 / 60, 6)
  })

  it('is confident in all of them, because none were stretched', () => {
    const est = garminFitness(healthDays(), 'metric')!
    expect(est.predictions.every((p) => p.confidence === 'high')).toBe(true)
    expect(est.predictions.every((p) => p.source.name === 'Garmin')).toBe(true)
  })

  it('derives VDOT and training paces from the 5K prediction', () => {
    const est = garminFitness(healthDays(), 'metric')!
    expect(est.vdot).toBeCloseTo(vdot(5, 1272 / 60) as number, 6)
    expect(est.source.label).toBe('5K')
    expect(est.paces).toHaveLength(5)
  })

  it('works from a partial set, anchoring on whatever exists', () => {
    const partial: HealthDay[] = [{ date: '2026-07-26', metrics: { raceTime10k: 2640 } }]
    const est = garminFitness(partial, 'metric')!
    expect(est.predictions).toHaveLength(1)
    expect(est.source.label).toBe('10K')
  })

  it('is null when the watch has produced nothing, so the fallback can run', () => {
    expect(garminFitness([{ date: '2026-07-26', metrics: { steps: 100 } }], 'metric')).toBeNull()
    expect(garminFitness([], 'metric')).toBeNull()
  })

  it('ignores a zero, which means "not computed" rather than an instant race', () => {
    const zeroed: HealthDay[] = [{ date: '2026-07-26', metrics: { raceTime5k: 0, raceTime10k: 2640 } }]
    const est = garminFitness(zeroed, 'metric')!
    expect(est.predictions.map((p) => p.label)).toEqual(['10K'])
  })

  it('paces convert with the display unit', () => {
    const metric = garminFitness(healthDays(), 'metric')!
    const imperial = garminFitness(healthDays(), 'imperial')!
    expect(imperial.predictions[0].pace / metric.predictions[0].pace).toBeCloseTo(1.60934, 3)
  })
})

describe('garminVdotTrend', () => {
  const day = (date: string, secs: number): HealthDay => ({ date, metrics: { raceTime5k: secs } })

  it('tracks improvement as a rising VDOT', () => {
    const trend = garminVdotTrend(
      [day('2026-07-20', 1272), day('2026-05-10', 1400)],
      { kind: 'all' },
      '2026-07-27',
    )
    const points = trend.filter((p) => p.vdot !== null)
    expect((points[points.length - 1].vdot as number)).toBeGreaterThan(points[0].vdot as number)
  })

  it('takes the best prediction in each period', () => {
    const trend = garminVdotTrend(
      [day('2026-07-20', 1400), day('2026-07-22', 1272)],
      { kind: 'all' },
      '2026-07-27',
    )
    expect(trend[0].vdot).toBeCloseTo(vdot(5, 1272 / 60) as number, 6)
  })

  it('is empty when the watch never predicted anything', () => {
    expect(garminVdotTrend([{ date: '2026-07-20', metrics: { steps: 5 } }], { kind: 'all' }, '2026-07-27')).toEqual([])
  })
})

describe('VO2 max', () => {
  const day = (date: string, vo2max?: number): HealthDay => ({
    date,
    metrics: vo2max === undefined ? {} : { vo2max },
  })

  it('reads the most recent recorded value', () => {
    const got = latestVo2max([day('2026-07-27'), day('2026-07-26', 47.2), day('2026-07-20', 46.0)])!
    expect(got.value).toBe(47.2)
    expect(got.date).toBe('2026-07-26')
  })

  it('treats a zero as not recorded rather than as a reading', () => {
    expect(latestVo2max([day('2026-07-26', 0)])).toBeNull()
    expect(latestVo2max([])).toBeNull()
  })

  it('takes the best value in each period', () => {
    const trend = vo2maxTrend(
      [day('2026-07-20', 46.0), day('2026-07-22', 47.5)],
      { kind: 'all' },
      '2026-07-27',
    )
    expect(trend[0].vdot).toBe(47.5)
  })

  it('offers no predicted race time, because capacity alone does not imply one', () => {
    const trend = vo2maxTrend([day('2026-07-20', 46.0)], { kind: 'all' }, '2026-07-27')
    expect(trend[0].predicted5k).toBeNull()
  })

  it('is empty when the watch never recorded one', () => {
    expect(vo2maxTrend([day('2026-07-20')], { kind: 'all' }, '2026-07-27')).toEqual([])
  })

  it('respects the selected range', () => {
    const trend = vo2maxTrend(
      [day('2026-07-20', 47), day('2025-01-05', 40)],
      { kind: 'days', days: 30 },
      '2026-07-27',
    )
    expect(trend.every((p) => p.vdot === null || p.vdot === 47)).toBe(true)
  })
})

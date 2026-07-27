import { describe, expect, it } from 'vitest'
import {
  METRIC_FAMILIES,
  familyFor,
  familyMembers,
  groupedMetricEntries,
  metricMeta,
  resolveFamily,
} from './healthMetrics'

/** Every metric a full Garmin import produces today. */
const ALL_KEYS = [
  'steps', 'distanceKm', 'floors', 'intensityMinutes', 'moderateIntensityMinutes',
  'vigorousIntensityMinutes', 'activeCalories', 'totalCalories', 'hydrationMl',
  'restingHr', 'maxHr', 'hrv', 'stress', 'maxStress', 'bodyBattery', 'bodyBatteryHigh',
  'bodyBatteryLow', 'bodyBatteryCharged', 'bodyBatteryDrained', 'spo2', 'spo2Low',
  'respiration', 'respirationMin', 'respirationMax',
  'sleepMinutes', 'sleepScore', 'deepSleepMinutes', 'remSleepMinutes', 'lightSleepMinutes',
  'awakeMinutes',
  'vo2max', 'vo2maxCycling', 'trainingReadiness', 'acuteLoad', 'enduranceScore', 'hillScore',
  'fitnessAge', 'raceTime5k', 'raceTime10k', 'raceTimeHalf', 'raceTimeMarathon',
  'bmi', 'muscleMassKg', 'boneMassKg', 'bodyWaterPct', 'physiqueRating', 'visceralFat',
  'metabolicAge',
]

function allEntries(keys: string[]) {
  return groupedMetricEntries(keys).flatMap((g) => g.entries)
}

/** Every metric key reachable from a set of entries, tiles and their members. */
function reachable(entries: ReturnType<typeof allEntries>): Set<string> {
  const out = new Set<string>()
  for (const e of entries) {
    if (e.kind === 'metric') out.add(e.key)
    else for (const k of e.resolved.members) out.add(k)
  }
  return out
}

describe('metric families', () => {
  it('never lets one metric belong to two families', () => {
    const seen = new Map<string, string>()
    for (const f of METRIC_FAMILIES) {
      for (const k of familyMembers(f)) {
        expect(seen.has(k), `${k} claimed by ${seen.get(k)} and ${f.key}`).toBe(false)
        seen.set(k, f.key)
      }
    }
  })

  it('puts every member in the same group as its family', () => {
    for (const f of METRIC_FAMILIES) {
      for (const k of familyMembers(f)) {
        expect(metricMeta(k).group, `${k}`).toBe(f.group)
      }
    }
  })

  it('only names metrics that exist in the catalog', () => {
    for (const f of METRIC_FAMILIES) {
      for (const k of familyMembers(f)) {
        // metricMeta derives a label for unknown keys, so check the catalog took it.
        expect(metricMeta(k).order, `${k} is not in the catalog`).toBeLessThan(100)
      }
    }
  })

  it('finds the family for any member, and none for a loner', () => {
    expect(familyFor('bodyBatteryDrained')?.key).toBe('bodyBattery')
    expect(familyFor('respirationMax')?.key).toBe('respiration')
    expect(familyFor('restingHr')).toBeUndefined()
    expect(familyFor('sleepScore')).toBeUndefined()
  })
})

describe('groupedMetricEntries', () => {
  const entries = allEntries(ALL_KEYS)

  it('loses nothing — every imported metric is still reachable', () => {
    const got = reachable(entries)
    for (const k of ALL_KEYS) expect(got.has(k), `${k} became unreachable`).toBe(true)
  })

  it('shows no metric twice', () => {
    const counts = new Map<string, number>()
    for (const e of entries) {
      const keys = e.kind === 'metric' ? [e.key] : e.resolved.members
      for (const k of keys) counts.set(k, (counts.get(k) ?? 0) + 1)
    }
    for (const [k, n] of counts) expect(n, `${k} appears ${n} times`).toBe(1)
  })

  it('cuts the tile count substantially', () => {
    // 48 metrics collapse to 30 tiles: eight families fold 26 metrics into 8,
    // and sleepScore stays on its own because a verdict is not a component.
    expect(ALL_KEYS).toHaveLength(48)
    const folded = METRIC_FAMILIES.reduce((n, f) => n + familyMembers(f).length, 0)
    expect(folded).toBe(26)
    expect(entries).toHaveLength(ALL_KEYS.length - folded + METRIC_FAMILIES.length)
    expect(entries).toHaveLength(30)
  })

  it('turns Body Battery from five tiles into one', () => {
    const bb = entries.filter((e) => e.key.startsWith('bodyBattery'))
    expect(bb).toHaveLength(1)
    expect(bb[0].kind).toBe('family')
    expect(bb[0].kind === 'family' && bb[0].resolved.members).toHaveLength(5)
  })

  it('turns six sleep metrics into a composition plus the score', () => {
    const sleep = groupedMetricEntries(ALL_KEYS).find((g) => g.group === 'sleep')!
    expect(sleep.entries).toHaveLength(2)
    const score = sleep.entries.find((e) => e.key === 'sleepScore')
    expect(score?.kind).toBe('metric')
  })

  it('folds the four race predictions into one tile', () => {
    const race = entries.filter((e) => e.key.startsWith('raceTime'))
    expect(race).toHaveLength(1)
    expect(race[0].kind === 'family' && race[0].resolved.members).toHaveLength(4)
  })

  it('leaves standalone metrics alone', () => {
    for (const k of ['steps', 'restingHr', 'hrv', 'bmi', 'trainingReadiness']) {
      const e = entries.find((x) => x.key === k)
      expect(e?.kind, k).toBe('metric')
    }
  })

  it('keeps groups in their catalog order', () => {
    const groups = groupedMetricEntries(ALL_KEYS).map((g) => g.group)
    expect(groups).toEqual(['training', 'heart', 'sleep', 'activity', 'body'])
  })

  it('handles an unknown metric without dropping it', () => {
    const got = reachable(allEntries([...ALL_KEYS, 'someNewGarminThing']))
    expect(got.has('someNewGarminThing')).toBe(true)
  })
})

describe('resolveFamily', () => {
  const bodyBattery = METRIC_FAMILIES.find((f) => f.key === 'bodyBattery')!

  it('is null when the device reported none of it', () => {
    expect(resolveFamily(bodyBattery, new Set(['steps']))).toBeNull()
  })

  it('promotes a member to headline when the primary is missing', () => {
    // A device that reports only the spread still gets a tile, not nothing. The
    // stand-in is the first member the family declares, so it is deterministic.
    const r = resolveFamily(bodyBattery, new Set(['bodyBatteryHigh', 'bodyBatteryLow']))!
    expect(r.headline).toBe('bodyBatteryLow')
    expect(r.members).toEqual(['bodyBatteryLow', 'bodyBatteryHigh'])
  })

  it('keeps the headline first in members', () => {
    const r = resolveFamily(bodyBattery, new Set(familyMembers(bodyBattery)))!
    expect(r.headline).toBe('bodyBattery')
    expect(r.members[0]).toBe('bodyBattery')
  })

  it('reports only the low/high that are actually present', () => {
    const r = resolveFamily(bodyBattery, new Set(['bodyBattery', 'bodyBatteryLow']))!
    expect(r.low).toBe('bodyBatteryLow')
    expect(r.high).toBeUndefined()
  })

  it('drops absent components from a composition', () => {
    const sleep = METRIC_FAMILIES.find((f) => f.key === 'sleepMinutes')!
    const r = resolveFamily(sleep, new Set(['sleepMinutes', 'deepSleepMinutes']))!
    expect(r.components).toEqual(['deepSleepMinutes'])
  })
})

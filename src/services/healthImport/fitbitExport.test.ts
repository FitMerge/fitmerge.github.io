import { describe, it, expect } from 'vitest'
import { zipSync, strToU8 } from 'fflate'
import { fitbitDateToIso, isFitbitExport, parseFitbitJson, parseFitbitZip } from './fitbitExport'

const LB_TO_KG = 1 / 2.20462

function jsonFile(obj: unknown): Uint8Array {
  return strToU8(JSON.stringify(obj))
}

/** Build a Takeout-shaped zip: files live under a "Takeout/Fitbit/…" tree. */
function takeoutZip(files: Record<string, Uint8Array>): Uint8Array {
  const tree: Record<string, Uint8Array> = {}
  for (const [name, bytes] of Object.entries(files)) tree[`Takeout/Fitbit/${name}`] = bytes
  return zipSync(tree)
}

describe('fitbitDateToIso', () => {
  it('reads ISO dates and datetimes', () => {
    expect(fitbitDateToIso('2025-07-12')).toBe('2025-07-12')
    expect(fitbitDateToIso('2025-07-11T23:30:00.000')).toBe('2025-07-11')
  })

  it('reads US M/D/YY dates with a time suffix', () => {
    expect(fitbitDateToIso('07/12/25 06:30:00')).toBe('2025-07-12')
    expect(fitbitDateToIso('7/2/25')).toBe('2025-07-02')
    expect(fitbitDateToIso('12/31/2024')).toBe('2024-12-31')
  })

  it('rejects junk and non-strings', () => {
    expect(fitbitDateToIso('')).toBeUndefined()
    expect(fitbitDateToIso('not a date')).toBeUndefined()
    expect(fitbitDateToIso(42)).toBeUndefined()
    expect(fitbitDateToIso('13/40/25')).toBeUndefined()
  })
})

describe('isFitbitExport', () => {
  it('recognises a Fitbit path segment', () => {
    expect(isFitbitExport(['Takeout/Fitbit/Global Export Data/weight-2025-07-01.json'])).toBe(true)
  })
  it('recognises known data files without the folder', () => {
    expect(isFitbitExport(['sleep-2025-07-01.json'])).toBe(true)
  })
  it('rejects an Apple Health zip', () => {
    expect(isFitbitExport(['apple_health_export/export.xml'])).toBe(false)
  })
})

describe('parseFitbitZip', () => {
  it('parses weight as pounds → kg, with body fat', async () => {
    const buf = takeoutZip({
      'Global Export Data/weight-2025-07-01.json': jsonFile([
        { logId: 1, weight: 154.3, date: '07/12/25', time: '12:00:00', bmi: 22.1, fat: 19.5 },
      ]),
    })
    const result = await parseFitbitZip(buf)
    expect(result.source).toBe('fitbit')
    expect(result.weights).toHaveLength(1)
    expect(result.weights[0].date).toBe('2025-07-12')
    expect(result.weights[0].weightKg).toBeCloseTo(154.3 * LB_TO_KG, 4)
    expect(result.weights[0].bodyFatPct).toBe(19.5)
  })

  it('parses sleep with stages into health metrics', async () => {
    const buf = takeoutZip({
      'Sleep/sleep-2025-07-01.json': jsonFile([
        {
          dateOfSleep: '2025-07-12',
          startTime: '2025-07-11T23:30:00.000',
          minutesAsleep: 420,
          minutesAwake: 45,
          efficiency: 91,
          type: 'stages',
          levels: {
            summary: {
              deep: { minutes: 70 },
              light: { minutes: 250 },
              rem: { minutes: 100 },
              wake: { minutes: 45 },
            },
          },
        },
      ]),
    })
    const result = await parseFitbitZip(buf)
    const day = result.health.find((h) => h.date === '2025-07-12')
    expect(day?.metrics.sleepMinutes).toBe(420)
    expect(day?.metrics.deepSleepMinutes).toBe(70)
    expect(day?.metrics.remSleepMinutes).toBe(100)
    expect(day?.metrics.lightSleepMinutes).toBe(250)
    expect(day?.metrics.awakeMinutes).toBe(45)
    expect(day?.metrics.sleepEfficiency).toBe(91)
  })

  it('imports arbitrary activity names (e.g. Yoga) as sessions', async () => {
    const buf = takeoutZip({
      'Physical Activity/exercise-0.json': jsonFile([
        { activityName: 'Yoga', startTime: '07/12/25 06:30:00', duration: 1800000, calories: 120, averageHeartRate: 92 },
        { activityName: 'Spinning', startTime: '07/13/25 18:00:00', duration: 2700000, calories: 350 },
      ]),
    })
    const result = await parseFitbitZip(buf)
    expect(result.sessions).toHaveLength(2)
    const yoga = result.sessions.find((s) => s.name === 'Yoga')
    expect(yoga?.date).toBe('2025-07-12')
    expect(yoga?.durationMin).toBeCloseTo(30, 5)
    expect(yoga?.kcal).toBe(120)
    expect(yoga?.avgHr).toBe(92)
    expect(yoga?.startTime).toBe('06:30')
  })

  it('sums intraday steps but lets a daily total win', async () => {
    const buf = takeoutZip({
      // intraday minute samples for 07-12
      'Global Export Data/steps-2025-07-12.json': jsonFile([
        { dateTime: '07/12/25 00:01:00', value: '100' },
        { dateTime: '07/12/25 00:02:00', value: '200' },
      ]),
      // date-only daily total for 07-13 (authoritative)
      'Physical Activity/steps-daily.json': jsonFile([{ dateTime: '07/13/25', value: '8452' }]),
    })
    const result = await parseFitbitZip(buf)
    expect(result.health.find((h) => h.date === '2025-07-12')?.metrics.steps).toBe(300)
    expect(result.health.find((h) => h.date === '2025-07-13')?.metrics.steps).toBe(8452)
  })

  it('parses resting heart rate and sleep score, merged onto the same day', async () => {
    const buf = takeoutZip({
      'Global Export Data/resting_heart_rate-2025-07-01.json': jsonFile([
        { dateTime: '07/12/25 00:00:00', value: { date: '07/12/25', value: 58.6, error: 6.5 } },
      ]),
      'Sleep Score/sleep_score.csv': strToU8(
        'sleep_log_entry_id,timestamp,overall_score,deep_sleep_in_minutes\n123,2025-07-12T08:00:00Z,84,70\n',
      ),
    })
    const result = await parseFitbitZip(buf)
    const day = result.health.find((h) => h.date === '2025-07-12')
    expect(day?.metrics.restingHr).toBe(59)
    expect(day?.metrics.sleepScore).toBe(84)
  })

  it('throws when the zip has no usable Fitbit data', async () => {
    const buf = takeoutZip({ 'Global Export Data/heart_rate-2025-07-01.json': jsonFile([{ x: 1 }]) })
    await expect(parseFitbitZip(buf)).rejects.toThrow(/No Fitbit/)
  })

  it('survives a malformed file without sinking the import', async () => {
    const buf = takeoutZip({
      'Global Export Data/weight-2025-07-01.json': strToU8('{ this is not json'),
      'Global Export Data/weight-2025-08-01.json': jsonFile([{ weight: 150, date: '08/01/25' }]),
    })
    const result = await parseFitbitZip(buf)
    expect(result.weights).toHaveLength(1)
    expect(result.weights[0].date).toBe('2025-08-01')
  })
})

describe('parseFitbitJson (single extracted file)', () => {
  it('sniffs a weight file', () => {
    const result = parseFitbitJson(JSON.stringify([{ weight: 154.3, date: '07/12/25' }]))
    expect(result.weights).toHaveLength(1)
  })
  it('sniffs an exercise file', () => {
    const result = parseFitbitJson(JSON.stringify([{ activityName: 'Yoga', startTime: '07/12/25 06:30:00', duration: 1800000, calories: 120 }]))
    expect(result.sessions[0].name).toBe('Yoga')
  })
  it('distinguishes resting-HR (nested value) from steps (scalar value)', () => {
    const rhr = parseFitbitJson(JSON.stringify([{ dateTime: '07/12/25 00:00:00', value: { value: 58 } }]))
    expect(rhr.health[0].metrics.restingHr).toBe(58)
    const steps = parseFitbitJson(JSON.stringify([{ dateTime: '07/12/25', value: '5000' }]))
    expect(steps.health[0].metrics.steps).toBe(5000)
  })
  it('rejects non-Fitbit JSON', () => {
    expect(() => parseFitbitJson(JSON.stringify([{ foo: 'bar' }]))).toThrow()
    expect(() => parseFitbitJson('not json')).toThrow()
  })
})

// Covers detectAndParse's routing — especially zip sniffing (Apple vs Fitbit), which the
// per-parser tests don't reach.

import { describe, it, expect } from 'vitest'
import { zipSync, strToU8 } from 'fflate'
import { detectAndParse } from './index'

function fileFrom(bytes: Uint8Array, name: string): File {
  return new File([bytes as unknown as BlobPart], name, { type: 'application/octet-stream' })
}

describe('detectAndParse routing', () => {
  it('routes a Fitbit Takeout zip to the Fitbit parser', async () => {
    const zip = zipSync({
      'Takeout/Fitbit/Global Export Data/weight-2025-07-01.json': strToU8(
        JSON.stringify([{ weight: 150, date: '07/12/25' }]),
      ),
    })
    const result = await detectAndParse(fileFrom(zip, 'takeout.zip'))
    expect(result.source).toBe('fitbit')
    expect(result.weights).toHaveLength(1)
  })

  it('routes an Apple Health zip to the Apple parser', async () => {
    const xml = '<?xml version="1.0"?><HealthData><Record type="HKQuantityTypeIdentifierBodyMass" startDate="2025-07-12 08:00:00 -0700" unit="lb" value="150"/></HealthData>'
    const zip = zipSync({ 'apple_health_export/export.xml': strToU8(xml) })
    const result = await detectAndParse(fileFrom(zip, 'export.zip'))
    expect(result.source).toBe('apple-health')
    expect(result.weights).toHaveLength(1)
  })

  it('routes a single extracted Fitbit JSON file', async () => {
    const json = JSON.stringify([{ activityName: 'Yoga', startTime: '07/12/25 06:30:00', duration: 1800000, calories: 120 }])
    const result = await detectAndParse(fileFrom(strToU8(json), 'exercise-0.json'))
    expect(result.source).toBe('fitbit')
    expect(result.sessions[0].name).toBe('Yoga')
  })

  it('still routes a FitMerge JSON file', async () => {
    const json = JSON.stringify({ version: 1, weights: [{ date: '2025-07-12', weightKg: 70 }] })
    const result = await detectAndParse(fileFrom(strToU8(json), 'export.json'))
    expect(result.source).toBe('fitmerge-json')
  })

  it('rejects an unrecognized zip', async () => {
    const zip = zipSync({ 'random/thing.txt': strToU8('hello') })
    await expect(detectAndParse(fileFrom(zip, 'mystery.zip'))).rejects.toThrow(/Unrecognized zip/)
  })
})

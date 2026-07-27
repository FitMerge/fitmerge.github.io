import { describe, expect, it } from 'vitest'
import { todayHighlights } from './healthToday'
import type { HealthDay } from '../../types'

/** Newest-first days, `series[key](daysAgo)` supplying each value. */
function daysDesc(
  n: number,
  series: Record<string, (daysAgo: number) => number | undefined>,
): HealthDay[] {
  const out: HealthDay[] = []
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
    out.push({ date: iso, metrics })
  }
  return out
}

const noteFor = (hs: ReturnType<typeof todayHighlights>, key: string) =>
  hs.find((h) => h.key === key)?.note

describe('todayHighlights', () => {
  it('calls a naturally noisy metric normal instead of flagging it daily', () => {
    // HRV swinging 50-70 is ordinary. The old fixed 5% threshold called almost
    // every night "below normal", which is how a signal becomes wallpaper.
    const desc = daysDesc(40, { hrv: (i) => (i === 0 ? 56 : 60 + ((i * 7) % 20) - 10) })
    expect(noteFor(todayHighlights(desc), 'hrv')).toBe('in your normal range')
  })

  it('still flags a reading that genuinely leaves the range', () => {
    const desc = daysDesc(40, { hrv: (i) => (i === 0 ? 30 : 60 + (i % 2 ? 2 : -2)) })
    const note = noteFor(todayHighlights(desc), 'hrv')
    expect(note).toContain('below normal')
  })

  it('knows which direction is good', () => {
    const lowRhr = daysDesc(40, { restingHr: (i) => (i === 0 ? 45 : 54 + (i % 2 ? 1 : -1)) })
    const highRhr = daysDesc(40, { restingHr: (i) => (i === 0 ? 64 : 54 + (i % 2 ? 1 : -1)) })
    expect(todayHighlights(lowRhr).find((h) => h.key === 'restingHr')?.tone).toBe('good')
    expect(todayHighlights(highRhr).find((h) => h.key === 'restingHr')?.tone).toBe('bad')

    const highHrv = daysDesc(40, { hrv: (i) => (i === 0 ? 90 : 60 + (i % 2 ? 1 : -1)) })
    expect(todayHighlights(highHrv).find((h) => h.key === 'hrv')?.tone).toBe('good')
  })

  it('never compares a reading against a baseline containing itself', () => {
    // Today is an extreme outlier; if it leaked into the baseline it would drag
    // the median toward itself and the day would read as normal.
    const desc = daysDesc(40, { restingHr: (i) => (i === 0 ? 80 : 54) })
    expect(noteFor(todayHighlights(desc), 'restingHr')).toContain('above normal')
  })

  it('says only that it was logged when there is no baseline yet', () => {
    const desc = daysDesc(3, { hrv: () => 60 })
    expect(noteFor(todayHighlights(desc), 'hrv')).toBe('logged today')
  })

  it('skips metrics with no reading at all', () => {
    const desc = daysDesc(40, { hrv: () => 60 })
    expect(todayHighlights(desc).map((h) => h.key)).toEqual(['hrv'])
  })

  it('uses short labels that fit a home tile', () => {
    const desc = daysDesc(40, { restingHr: () => 54, sleepMinutes: () => 420 })
    const labels = todayHighlights(desc).map((h) => h.label)
    expect(labels).toContain('Resting HR')
    expect(labels).toContain('Sleep')
  })
})

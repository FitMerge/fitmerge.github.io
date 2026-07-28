import { describe, expect, it } from 'vitest'
import { addDays, todayISO } from '../../lib/date'
import { epley1RM, personalRecords } from './utils'
import type { WorkoutSession } from '../../types'

/** `n` days before today. Dates are relative so these tests do not rot. */
const ago = (n: number): string => addDays(todayISO(), -n)

describe('epley1RM', () => {
  it('adds a thirtieth of the load per rep', () => {
    expect(epley1RM(100, 10)).toBeCloseTo(133.333, 3)
    expect(epley1RM(100, 5)).toBeCloseTo(116.667, 3)
  })

  it('overestimates a true single, as Epley does by construction', () => {
    // Documenting the known quirk: a 1-rep set does not return the raw weight.
    expect(epley1RM(100, 1)).toBeCloseTo(103.333, 3)
  })

  it('returns the raw weight for a zero-rep set', () => {
    expect(epley1RM(100, 0)).toBe(100)
  })

  it('rises with both weight and reps', () => {
    expect(epley1RM(110, 5)).toBeGreaterThan(epley1RM(100, 5))
    expect(epley1RM(100, 6)).toBeGreaterThan(epley1RM(100, 5))
  })
})

// --- personalRecords / exerciseTrends ---------------------------------------

function session(date: string, entries: Record<string, [number, number][]>): WorkoutSession {
  return {
    id: date + Object.keys(entries).join(),
    name: 'W',
    date,
    startedAt: 0,
    finishedAt: 1,
    entries: Object.entries(entries).map(([exerciseId, sets]) => ({
      exerciseId,
      sets: sets.map(([weight, reps]) => ({ weight, reps, done: true })),
    })),
  }
}

describe('personalRecords', () => {
  it('puts the most recent record first, not the heaviest', () => {
    // The bug: ranked by est-1RM and capped at five, the card was a permanent
    // list of the biggest lifts. A curl PR set today could never displace a
    // deadlift, so the section looked frozen after every workout.
    const sessions = [
      session(ago(26), { deadlift: [[400, 5]] }),
      session(ago(1), { curl: [[40, 10]] }),
    ]
    expect(personalRecords(sessions).map((p) => p.exerciseId)).toEqual(['curl', 'deadlift'])
  })

  it('reports every exercise, not just the top five', () => {
    const sessions = [
      session(ago(26), {
        a: [[100, 5]], b: [[90, 5]], c: [[80, 5]], d: [[70, 5]], e: [[60, 5]], f: [[50, 5]],
      }),
    ]
    expect(personalRecords(sessions)).toHaveLength(6)
  })

  it('dates a record to the day it was first reached', () => {
    // Equalling a record later does not re-date it — you set it the first time.
    const sessions = [
      session(ago(18), { bench: [[200, 5]] }),
      session(ago(8), { bench: [[200, 5]] }),
    ]
    expect(personalRecords(sessions)[0].date).toBe(ago(18))
  })

  it('moves the date forward when the record is actually beaten', () => {
    const sessions = [
      session(ago(18), { bench: [[200, 5]] }),
      session(ago(8), { bench: [[205, 5]] }),
    ]
    const pr = personalRecords(sessions)[0]
    expect(pr.date).toBe(ago(8))
    expect(pr.weight).toBe(205)
  })

  it('ignores unfinished sessions and warmup sets', () => {
    const live = { ...session(ago(1), { bench: [[300, 5]] }), finishedAt: undefined }
    const warm = session(ago(2), { bench: [[250, 5]] })
    warm.entries[0].sets[0].type = 'warmup'
    expect(personalRecords([live, warm])).toEqual([])
  })

  it('is not fooled by sessions stored out of date order', () => {
    // The store appends, so array order is not date order.
    const sessions = [
      session(ago(8), { bench: [[200, 5]] }),
      session(ago(18), { bench: [[200, 5]] }),
    ]
    expect(personalRecords(sessions)[0].date).toBe(ago(18))
  })
})

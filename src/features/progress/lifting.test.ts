import { describe, expect, it } from 'vitest'
import { addDays, todayISO } from '../../lib/date'
import { exerciseSeries, exerciseSummaries, liftRangeStart } from './lifting'
import type { SetLog, WorkoutSession } from '../../types'

/** `n` days before today. Dates are relative so these tests do not rot. */
const ago = (n: number): string => addDays(todayISO(), -n)

type SetSpec = [weight: number, reps: number, type?: SetLog['type']]

function session(date: string, entries: Record<string, SetSpec[]>): WorkoutSession {
  return {
    id: date + Object.keys(entries).join(),
    name: 'W',
    date,
    startedAt: 0,
    finishedAt: 1,
    entries: Object.entries(entries).map(([exerciseId, sets]) => ({
      exerciseId,
      sets: sets.map(([weight, reps, type]) => ({ weight, reps, done: true, type })),
    })),
  }
}

// One session: a top single, a hard set of five, and a light long set.
// heaviest      = 250
// best set      = max(250×1, 200×5, 100×20) = 2000  (the light set!)
// session total = 250 + 1000 + 2000 = 3250
const MIXED = [session(ago(1), { bench: [[250, 1], [200, 5], [100, 20]] })]

describe('exerciseSeries metrics', () => {
  it('reads heaviest as the top weight regardless of reps', () => {
    expect(exerciseSeries(MIXED, 'bench', 'heaviest', 'all')[0].value).toBe(250)
  })

  it('reads best set as the biggest single weight × reps', () => {
    // Deliberately the LIGHT set: 100×20 beats 200×5 on volume. This is the
    // documented trade-off of the metric, not a bug.
    expect(exerciseSeries(MIXED, 'bench', 'bestSet', 'all')[0].value).toBe(2000)
  })

  it('reads session total as every working set added up', () => {
    expect(exerciseSeries(MIXED, 'bench', 'sessionVolume', 'all')[0].value).toBe(3250)
  })

  it('reports the top set alongside a volume, so the number can be explained', () => {
    const p = exerciseSeries(MIXED, 'bench', 'sessionVolume', 'all')[0]
    expect(p.sets).toBe(3)
    expect(p.topWeight).toBe(250)
    expect(p.topReps).toBe(1)
  })

  it('excludes warmups from every metric', () => {
    const s = [session(ago(1), { bench: [[95, 10, 'warmup'], [200, 5]] })]
    expect(exerciseSeries(s, 'bench', 'heaviest', 'all')[0].value).toBe(200)
    expect(exerciseSeries(s, 'bench', 'sessionVolume', 'all')[0].value).toBe(1000)
  })

  it('skips a session where the exercise was only warmed up', () => {
    const s = [session(ago(1), { bench: [[95, 10, 'warmup']] })]
    expect(exerciseSeries(s, 'bench', 'heaviest', 'all')).toEqual([])
  })

  it('ignores unfinished sessions', () => {
    const live = { ...session(ago(1), { bench: [[200, 5]] }), finishedAt: undefined }
    expect(exerciseSeries([live], 'bench', 'heaviest', 'all')).toEqual([])
  })

  it('returns points oldest first whatever order the store held them in', () => {
    const s = [session(ago(1), { bench: [[210, 5]] }), session(ago(30), { bench: [[200, 5]] })]
    expect(exerciseSeries(s, 'bench', 'heaviest', 'all').map((p) => p.value)).toEqual([200, 210])
  })

  it('honours the range', () => {
    const s = [session(ago(200), { bench: [[100, 5]] }), session(ago(1), { bench: [[200, 5]] })]
    expect(exerciseSeries(s, 'bench', 'heaviest', '90d')).toHaveLength(1)
    expect(exerciseSeries(s, 'bench', 'heaviest', 'all')).toHaveLength(2)
  })
})

describe('liftRangeStart', () => {
  it('reaches back far enough that "all" cannot exclude a real session', () => {
    expect(liftRangeStart('all') < '1900-01-01').toBe(true)
  })
})

describe('exerciseSummaries', () => {
  it('orders by most recently trained, not by size', () => {
    // The failure this replaces: ranking by weight meant the same big lifts sat
    // at the top forever and today's work was buried.
    const s = [
      session(ago(20), { deadlift: [[400, 5]] }),
      session(ago(1), { curl: [[40, 10]] }),
    ]
    expect(exerciseSummaries(s, 'heaviest', 'all').map((x) => x.exerciseId)).toEqual([
      'curl',
      'deadlift',
    ])
  })

  it('summarises with the metric it was asked for', () => {
    const s = [session(ago(1), { bench: [[250, 1], [100, 20]] })]
    expect(exerciseSummaries(s, 'heaviest', 'all')[0].last).toBe(250)
    expect(exerciseSummaries(s, 'bestSet', 'all')[0].last).toBe(2000)
    expect(exerciseSummaries(s, 'sessionVolume', 'all')[0].last).toBe(2250)
  })

  it('tracks first, last and best across sessions', () => {
    const s = [
      session(ago(30), { bench: [[200, 5]] }),
      session(ago(15), { bench: [[220, 5]] }),
      session(ago(1), { bench: [[210, 5]] }),
    ]
    const sum = exerciseSummaries(s, 'heaviest', 'all')[0]
    expect(sum.first).toBe(200)
    expect(sum.last).toBe(210)
    expect(sum.best).toBe(220)
    expect(sum.values).toEqual([200, 220, 210])
    expect(sum.sessions).toBe(3)
  })

  it('leaves out an exercise that has no working sets at all', () => {
    const s = [session(ago(1), { bench: [[200, 5]], curl: [[30, 10, 'warmup']] })]
    expect(exerciseSummaries(s, 'heaviest', 'all').map((x) => x.exerciseId)).toEqual(['bench'])
  })
})

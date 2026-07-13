// Performance Management Chart (PMC) math — the CTL/ATL/TSB "fitness, fatigue,
// form" model popularized by TrainingPeaks. We don't get Garmin's native
// training-load number in the import, so daily load is approximated from each
// activity's calories (≈ kcal / 6 lands roughly in the familiar TSS range where
// ~1 hour at threshold ≈ 100). It's an estimate — the *shape* and the form
// balance are what matter, not the absolute calibration.

import type { WorkoutSession } from '../types'
import { addDays, todayISO } from './date'

export type PmcPoint = { date: string; load: number; ctl: number; atl: number; tsb: number }

// Exponential time constants (days): fitness accrues slowly, fatigue quickly.
const CTL_TC = 42
const ATL_TC = 7

/** Per-session load in TSS-like units from calories (fallback: duration). */
export function sessionLoad(s: WorkoutSession): number {
  if (typeof s.kcal === 'number' && s.kcal > 0) return s.kcal / 6
  if (typeof s.durationMin === 'number' && s.durationMin > 0) return s.durationMin
  return 0
}

/** Sum of load per calendar date across all finished/imported sessions. */
export function dailyLoadByDate(sessions: WorkoutSession[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const s of sessions) {
    if (!s.date) continue
    const load = sessionLoad(s)
    if (load <= 0) continue
    m.set(s.date, (m.get(s.date) ?? 0) + load)
  }
  return m
}

/**
 * Full daily PMC series from the first activity to today. CTL/ATL are
 * exponentially-weighted averages of daily load; TSB (form) is the PRIOR day's
 * CTL−ATL, the standard definition (today's freshness reflects yesterday's balance).
 */
export function performanceManagementChart(sessions: WorkoutSession[]): PmcPoint[] {
  const loads = dailyLoadByDate(sessions)
  const dates = [...loads.keys()].sort()
  if (dates.length === 0) return []

  const ctlAlpha = 1 - Math.exp(-1 / CTL_TC)
  const atlAlpha = 1 - Math.exp(-1 / ATL_TC)

  const end = todayISO()
  let ctl = 0
  let atl = 0
  const out: PmcPoint[] = []
  for (let d = dates[0]; d <= end; d = addDays(d, 1)) {
    const load = loads.get(d) ?? 0
    const tsb = ctl - atl // yesterday's balance, before today's load lands
    ctl += (load - ctl) * ctlAlpha
    atl += (load - atl) * atlAlpha
    out.push({ date: d, load, ctl, atl, tsb })
  }
  return out
}

export type FormState = { label: string; tone: 'good' | 'warn' | 'bad' | 'neutral'; detail: string }

/** Interpret a TSB (form) value into a training-readiness state. */
export function formState(tsb: number): FormState {
  if (tsb > 15) return { label: 'Fresh / detraining', tone: 'neutral', detail: 'Well recovered — good for racing, but fitness may fade if you stay here.' }
  if (tsb > 5) return { label: 'Fresh', tone: 'good', detail: 'Recovered and ready for hard efforts or an event.' }
  if (tsb >= -10) return { label: 'Neutral', tone: 'good', detail: 'Balanced load and recovery.' }
  if (tsb >= -30) return { label: 'Productive', tone: 'warn', detail: 'Solid training stress — the zone where fitness is built. Watch recovery.' }
  return { label: 'Overreaching', tone: 'bad', detail: 'Fatigue is high relative to fitness. Elevated injury/illness risk — consider easing off.' }
}

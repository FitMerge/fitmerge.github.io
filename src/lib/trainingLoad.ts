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

/**
 * Per-session training load in TSS-like units. Prefers Garmin's own
 * trainingLoad (a real TSS-equivalent) when the import provides it; otherwise
 * estimates from calories, then duration.
 */
export function sessionLoad(s: WorkoutSession): number {
  if (typeof s.trainingLoad === 'number' && s.trainingLoad > 0) return s.trainingLoad
  if (typeof s.kcal === 'number' && s.kcal > 0) return s.kcal / 6
  if (typeof s.durationMin === 'number' && s.durationMin > 0) return s.durationMin
  return 0
}

/** True if any session carries Garmin's native training-load number. */
export function hasRealTrainingLoad(sessions: WorkoutSession[]): boolean {
  return sessions.some((s) => typeof s.trainingLoad === 'number' && s.trainingLoad > 0)
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

export type AcwrLevel = 'low' | 'optimal' | 'high' | 'danger'
export type Acwr = { ratio: number; acute: number; chronic: number; level: AcwrLevel; label: string; detail: string }

/**
 * Acute:Chronic Workload Ratio — the injury-risk gauge. Acute = last 7 days of
 * load; chronic = average weekly load over the last 28 days. A ratio in the
 * 0.8–1.3 "sweet spot" is safe; spikes above ~1.5 are the classic elevated
 * injury-risk zone. Returns null if there isn't enough load history.
 */
export function acwr(sessions: WorkoutSession[]): Acwr | null {
  const loads = dailyLoadByDate(sessions)
  if (loads.size === 0) return null

  let acute = 0
  let chronic28 = 0
  for (let i = 0; i < 28; i++) {
    const d = addDays(todayISO(), -i)
    const load = loads.get(d) ?? 0
    if (i < 7) acute += load
    chronic28 += load
  }
  const chronic = chronic28 / 4 // 28 days → average weekly
  if (chronic <= 0) return null

  const ratio = acute / chronic
  let level: AcwrLevel
  let label: string
  let detail: string
  if (ratio < 0.8) {
    level = 'low'
    label = 'Detraining'
    detail = 'Your recent load is well below your normal — fitness may be slipping. Room to build.'
  } else if (ratio <= 1.3) {
    level = 'optimal'
    label = 'Sweet spot'
    detail = 'Your recent load is balanced against your baseline — the lowest-risk zone for building fitness.'
  } else if (ratio <= 1.5) {
    level = 'high'
    label = 'Ramping fast'
    detail = 'You are loading faster than your body has adapted to. Sustainable briefly, but watch recovery.'
  } else {
    level = 'danger'
    label = 'Injury-risk spike'
    detail = 'Your acute load is far above your baseline — the zone most associated with injury and illness. Back off.'
  }
  return { ratio, acute, chronic, level, label, detail }
}

/**
 * Project fitness/fatigue/form forward `horizon` days assuming a constant daily
 * load. `assumedDailyLoad` defaults to the average daily load (incl. rest days)
 * over the last 14 days, so "keep doing what you're doing" is the projection.
 */
export function projectPmc(sessions: WorkoutSession[], horizon = 28, assumedDailyLoad?: number): PmcPoint[] {
  const pmc = performanceManagementChart(sessions)
  if (pmc.length === 0) return []

  const loads = dailyLoadByDate(sessions)
  let recentSum = 0
  for (let i = 0; i < 14; i++) recentSum += loads.get(addDays(todayISO(), -i)) ?? 0
  const dailyLoad = assumedDailyLoad ?? recentSum / 14

  const ctlAlpha = 1 - Math.exp(-1 / CTL_TC)
  const atlAlpha = 1 - Math.exp(-1 / ATL_TC)

  const last = pmc[pmc.length - 1]
  let ctl = last.ctl
  let atl = last.atl
  const out: PmcPoint[] = []
  for (let i = 1; i <= horizon; i++) {
    const tsb = ctl - atl
    ctl += (dailyLoad - ctl) * ctlAlpha
    atl += (dailyLoad - atl) * atlAlpha
    out.push({ date: addDays(todayISO(), i), load: dailyLoad, ctl, atl, tsb })
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

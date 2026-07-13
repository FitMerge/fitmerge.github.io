// Rule-based recovery / readiness signals from imported daily health metrics.
// These are the "divergence / overreaching / illness" flags — recent values
// compared against each metric's own recent baseline. Deliberately simple and
// transparent (no ML): a raised resting HR together with suppressed HRV is the
// classic autonomic-stress / oncoming-illness signature.

import type { HealthDay } from '../types'
import { addDays, todayISO } from './date'

export type SignalLevel = 'red' | 'amber' | 'green'
export type CoachSignal = { level: SignalLevel; title: string; detail: string }

function samplesDesc(days: Record<string, HealthDay>, key: string): { date: string; value: number }[] {
  const out: { date: string; value: number }[] = []
  for (const day of Object.values(days)) {
    const v = day.metrics[key]
    if (typeof v === 'number' && Number.isFinite(v)) out.push({ date: day.date, value: v })
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : -1)) // newest first
}

/** Average of a metric over the [today-untilDaysAgo, today-fromDaysAgo] window. */
function windowAvg(days: Record<string, HealthDay>, key: string, fromDaysAgo: number, untilDaysAgo: number): number | null {
  const start = addDays(todayISO(), -untilDaysAgo)
  const end = addDays(todayISO(), -fromDaysAgo)
  let sum = 0
  let n = 0
  for (const s of samplesDesc(days, key)) {
    if (s.date >= start && s.date <= end) {
      sum += s.value
      n++
    }
  }
  return n ? sum / n : null
}

/**
 * Compare a recent 7-day window against a ~5-week baseline before it, and turn
 * the notable divergences into readiness flags. Returns a single green "all
 * clear" when nothing stands out (and there's enough data to say so).
 */
export function coachSignals(days: Record<string, HealthDay>): CoachSignal[] {
  const flags: CoachSignal[] = []

  const hrvRecent = windowAvg(days, 'hrv', 0, 6)
  const hrvBase = windowAvg(days, 'hrv', 7, 42)
  const rhrRecent = windowAvg(days, 'restingHr', 0, 6)
  const rhrBase = windowAvg(days, 'restingHr', 7, 42)

  const hrvDown = hrvRecent !== null && hrvBase !== null && hrvRecent < hrvBase * 0.9
  const rhrUp = rhrRecent !== null && rhrBase !== null && rhrRecent > rhrBase + 4

  if (hrvDown && rhrUp) {
    flags.push({
      level: 'red',
      title: 'Autonomic stress — HRV down & resting HR up',
      detail: `HRV is down ~${Math.round((1 - hrvRecent! / hrvBase!) * 100)}% and resting HR is up ~${Math.round(rhrRecent! - rhrBase!)} bpm vs your baseline. Classic sign of accumulated fatigue or an oncoming illness — prioritize rest.`,
    })
  } else {
    if (hrvDown) {
      flags.push({
        level: 'amber',
        title: 'HRV suppressed',
        detail: `Your 7-day HRV (${Math.round(hrvRecent!)} ms) is below your baseline (${Math.round(hrvBase!)} ms). Often means you haven't fully recovered.`,
      })
    }
    if (rhrUp) {
      flags.push({
        level: 'amber',
        title: 'Resting heart rate elevated',
        detail: `Resting HR is averaging ${Math.round(rhrRecent!)} bpm vs a baseline of ${Math.round(rhrBase!)} bpm — a mild stress or under-recovery signal.`,
      })
    }
  }

  const sleepRecent = windowAvg(days, 'sleepMinutes', 0, 2)
  if (sleepRecent !== null && sleepRecent < 360) {
    flags.push({
      level: 'amber',
      title: 'Sleep deficit',
      detail: `You've averaged ${Math.floor(sleepRecent / 60)}h ${Math.round(sleepRecent % 60)}m over the last 3 nights. Under ~6h blunts recovery and raises injury risk.`,
    })
  }

  const bbRecent = windowAvg(days, 'bodyBattery', 0, 2)
  if (bbRecent !== null && bbRecent < 25) {
    flags.push({
      level: 'amber',
      title: 'Low Body Battery',
      detail: `Body Battery is averaging ${Math.round(bbRecent)} — your energy reserves are running low. An easy day would help.`,
    })
  }

  if (flags.length === 0) {
    const haveData = hrvBase !== null || rhrBase !== null
    flags.push({
      level: 'green',
      title: haveData ? 'No red flags — recovery looks clean' : 'Not enough data yet',
      detail: haveData
        ? 'Your recent HRV, resting HR, sleep and Body Battery are all in line with your baselines.'
        : 'Import a few weeks of Garmin data to unlock recovery signals.',
    })
  }

  return flags
}

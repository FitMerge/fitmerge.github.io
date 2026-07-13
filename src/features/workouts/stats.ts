import { getExerciseById } from '../../data/exercises'
import { MUSCLE_LABELS, type MuscleId } from '../../data/muscles'
import { addDays, todayISO } from '../../lib/date'
import { isWorkingSet, sessionDurationMs, totalVolume } from './utils'
import type { WorkoutSession } from '../../types'

export type LifetimeStats = {
  workouts: number
  volume: number
  reps: number
  sets: number
  durationMs: number
}

/** Whole-history training totals across finished sessions. */
export function lifetimeStats(sessions: WorkoutSession[]): LifetimeStats {
  const finished = sessions.filter((s) => s.finishedAt !== undefined)
  let volume = 0
  let reps = 0
  let sets = 0
  let durationMs = 0
  for (const s of finished) {
    volume += totalVolume(s)
    durationMs += sessionDurationMs(s)
    for (const e of s.entries) {
      for (const set of e.sets) {
        if (isWorkingSet(set)) {
          sets += 1
          reps += set.reps
        }
      }
    }
  }
  return { workouts: finished.length, volume, reps, sets, durationMs }
}

export type WeekBar = { label: string; count: number; volume: number }

/** Finished workouts + volume bucketed into the last `weeks` calendar weeks (oldest→newest). */
export function workoutsPerWeek(sessions: WorkoutSession[], weeks: number): WeekBar[] {
  const finished = sessions.filter((s) => s.finishedAt !== undefined)
  const bars: WeekBar[] = []
  for (let i = weeks - 1; i >= 0; i--) {
    const end = addDays(todayISO(), -i * 7)
    const start = addDays(end, -6)
    const inWeek = finished.filter((s) => s.date >= start && s.date <= end)
    bars.push({
      label: monthDay(start),
      count: inWeek.length,
      volume: inWeek.reduce((sum, s) => sum + totalVolume(s), 0),
    })
  }
  return bars
}

export type MuscleSets = { muscle: MuscleId; label: string; sets: number }

/**
 * Working sets attributed to each muscle over the last `days`. A set counts once
 * for every primary muscle of its exercise (Hevy-style muscle balance view).
 */
export function muscleSetVolume(sessions: WorkoutSession[], days: number): MuscleSets[] {
  const since = addDays(todayISO(), -(days - 1))
  const counts = new Map<MuscleId, number>()
  for (const s of sessions) {
    if (!s.finishedAt || s.date < since) continue
    for (const e of s.entries) {
      const working = e.sets.filter(isWorkingSet).length
      if (working === 0) continue
      const muscles = getExerciseById(e.exerciseId)?.primaryMuscles ?? []
      for (const m of muscles) counts.set(m, (counts.get(m) ?? 0) + working)
    }
  }
  return Array.from(counts.entries())
    .map(([muscle, sets]) => ({ muscle, label: MUSCLE_LABELS[muscle], sets }))
    .sort((a, b) => b.sets - a.sets)
}

/** Count of consecutive weeks (ending this week) with at least one finished workout. */
export function weeklyStreak(sessions: WorkoutSession[]): number {
  const finished = sessions.filter((s) => s.finishedAt !== undefined)
  if (finished.length === 0) return 0
  let streak = 0
  for (let i = 0; i < 260; i++) {
    const end = addDays(todayISO(), -i * 7)
    const start = addDays(end, -6)
    const hit = finished.some((s) => s.date >= start && s.date <= end)
    if (hit) streak += 1
    else if (i > 0) break // allow the current (possibly empty) week not to break the streak at i=0
    else continue
  }
  return streak
}

function monthDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

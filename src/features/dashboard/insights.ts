// Rule-based daily coaching: turns the cross-store HomeData snapshot into a short,
// prioritized list of plain-language reads ("green light to train", "protein behind
// pace", "down 7 lb this quarter"). Deterministic and free — no AI call — mirroring
// the guidance style of Whoop/Oura daily briefs. Each insight links to the page
// where the user can act on it.

import type { HomeData } from './homeData'
import { mlToFloz, weightUnit } from '../../lib/units'
import { totalVolume } from '../workouts/utils'

export type InsightTone = 'good' | 'warn' | 'info'
export type InsightIcon =
  | 'recovery'
  | 'sleep'
  | 'training'
  | 'nutrition'
  | 'protein'
  | 'hydration'
  | 'weight'
  | 'streak'
  | 'supplement'
  | 'pr'
  | 'stress'

export type Insight = {
  id: string
  tone: InsightTone
  icon: InsightIcon
  title: string
  body: string
  /** Route the insight links to. */
  to: string
}

function fmtSleep(min: number): string {
  return `${Math.floor(min / 60)}h ${String(Math.round(min % 60)).padStart(2, '0')}m`
}

function fmtVolume(v: number): string {
  return v >= 10_000 ? `${(v / 1000).toFixed(1)}k` : Math.round(v).toLocaleString()
}

/**
 * Build the day's coaching feed, highest priority first. `hour` is the local
 * hour-of-day (0–23), injected so pace-based rules are testable.
 */
export function buildInsights(d: HomeData, hour: number): Insight[] {
  const out: Insight[] = []
  const rhr = d.highlights.find((h) => h.key === 'restingHr')
  const hrv = d.highlights.find((h) => h.key === 'hrv')
  const sleep = d.highlights.find((h) => h.key === 'sleepMinutes')
  const stress = d.highlights.find((h) => h.key === 'stress')

  // --- New personal record — always leads when it happened -----------------------------
  if (d.recentPR) {
    out.push({
      id: 'pr',
      tone: 'good',
      icon: 'pr',
      title: `New ${d.recentPR.exerciseName} PR 🎉`,
      body: `${d.recentPR.weight} ${weightUnit(d.units)} × ${d.recentPR.reps} this week — a new best estimated 1RM of ${Math.round(d.recentPR.est1RM)} ${weightUnit(d.units)}.`,
      to: '/progress',
    })
  }

  // --- Recovery verdict, fused with the training plan --------------------------------
  if (d.hero) {
    const recoveryBad = rhr?.tone === 'bad' && hrv?.tone === 'bad'
    if (d.hero.value < 33 || recoveryBad) {
      out.push({
        id: 'recovery-low',
        tone: 'warn',
        icon: 'recovery',
        title: 'Take it easier today',
        body: `${d.hero.label} is at ${Math.round(d.hero.value)} and your recovery markers are off baseline — keep intensity light and get to bed early.`,
        to: '/health',
      })
    } else if (d.hero.value >= 66 && d.todaysRoutine && !d.trainedToday && !d.activeSessionId) {
      const signals = [
        hrv?.tone === 'good' ? 'HRV above normal' : null,
        rhr?.tone === 'good' ? 'resting HR low' : null,
      ].filter(Boolean)
      out.push({
        id: 'recovery-green',
        tone: 'good',
        icon: 'recovery',
        title: `Green light for ${d.todaysRoutine.name}`,
        body: `${d.hero.label} ${Math.round(d.hero.value)}${signals.length ? ` with ${signals.join(' and ')}` : ''} — a good day to push hard.`,
        to: '/workouts',
      })
    } else if (d.hero.value < 66) {
      out.push({
        id: 'recovery-mid',
        tone: 'info',
        icon: 'recovery',
        title: 'Moderate recovery',
        body: `${d.hero.label} is at ${Math.round(d.hero.value)} — train, but leave a rep or two in the tank.`,
        to: '/health',
      })
    }
  }

  // --- Sleep -------------------------------------------------------------------------
  if (sleep && d.sleepMinutes != null) {
    if (sleep.tone === 'bad') {
      out.push({
        id: 'sleep-short',
        tone: 'warn',
        icon: 'sleep',
        title: `Short night — ${fmtSleep(d.sleepMinutes)}`,
        body: `That's ${sleep.note.replace(' below normal', '')} under your usual. An earlier night tonight will pay back tomorrow's training.`,
        to: '/health',
      })
    } else if (sleep.tone === 'good') {
      out.push({
        id: 'sleep-good',
        tone: 'good',
        icon: 'sleep',
        title: `Well slept — ${fmtSleep(d.sleepMinutes)}`,
        body: `${sleep.note.replace('above normal', 'above your usual')} — recovery loves it.`,
        to: '/health',
      })
    }
  }

  // --- Stress ------------------------------------------------------------------------
  if (stress?.tone === 'bad') {
    out.push({
      id: 'stress-high',
      tone: 'warn',
      icon: 'stress',
      title: `Stress running high — ${stress.value}`,
      body: `That's ${stress.note}. A walk, some sun or 5 minutes of slow breathing genuinely moves this number.`,
      to: '/health',
    })
  }

  // --- Today's training status -------------------------------------------------------
  if (d.trainedToday) {
    const vol = d.week.last && d.week.last.date === d.today ? Math.round(totalVolume(d.week.last)) : 0
    out.push({
      id: 'trained',
      tone: 'good',
      icon: 'training',
      title: 'Workout done ✓',
      body: vol > 0 ? `${fmtVolume(vol)} ${weightUnit(d.units)} moved today. Refuel and hydrate.` : 'Session logged. Refuel and hydrate.',
      to: '/workouts',
    })
  } else if (d.todaysRoutine && !d.activeSessionId && !out.some((i) => i.id === 'recovery-green')) {
    out.push({
      id: 'plan-today',
      tone: 'info',
      icon: 'training',
      title: `${d.todaysRoutine.name} on deck`,
      body: `${d.todaysRoutine.items.length} exercises planned for today.`,
      to: '/workouts',
    })
  } else if (!d.todaysRoutine && d.week.sessions === 0 && hour >= 12) {
    out.push({
      id: 'no-training-week',
      tone: 'warn',
      icon: 'training',
      title: 'No workouts yet this week',
      body: 'Even a short session keeps the habit alive — the + button starts one.',
      to: '/workouts',
    })
  }

  // --- Weekly volume vs last week ----------------------------------------------------
  if (d.week.prevVolume > 1000 && d.week.volume > 0) {
    const pct = Math.round(((d.week.volume - d.week.prevVolume) / d.week.prevVolume) * 100)
    if (pct >= 10) {
      out.push({
        id: 'volume-up',
        tone: 'good',
        icon: 'training',
        title: `Training volume up ${pct}%`,
        body: `${fmtVolume(d.week.volume)} ${weightUnit(d.units)} this week vs ${fmtVolume(d.week.prevVolume)} last — nice overload.`,
        to: '/progress',
      })
    } else if (pct <= -25) {
      out.push({
        id: 'volume-down',
        tone: 'info',
        icon: 'training',
        title: 'Lighter training week so far',
        body: `${fmtVolume(d.week.volume)} ${weightUnit(d.units)} vs ${fmtVolume(d.week.prevVolume)} last week. Deload or just busy? ${d.week.sessions} session${d.week.sessions === 1 ? '' : 's'} in.`,
        to: '/progress',
      })
    }
  }

  // --- Nutrition pace ----------------------------------------------------------------
  const proteinLeft = Math.round(d.goals.protein - d.protein)
  if (d.mealsLogged > 0) {
    if (d.remaining < 0) {
      out.push({
        id: 'over-cal',
        tone: 'warn',
        icon: 'nutrition',
        title: `${Math.abs(d.remaining).toLocaleString()} kcal over budget`,
        body: 'A walk tonight or a lighter dinner brings the day back in range.',
        to: '/nutrition',
      })
    }
    if (proteinLeft > d.goals.protein * 0.35 && hour >= 15) {
      out.push({
        id: 'protein-behind',
        tone: 'warn',
        icon: 'protein',
        title: `${proteinLeft} g protein still to go`,
        body: 'A chicken breast and a shake would just about cover it.',
        to: '/nutrition',
      })
    } else if (proteinLeft <= 0) {
      out.push({
        id: 'protein-hit',
        tone: 'good',
        icon: 'protein',
        title: 'Protein goal hit',
        body: `${Math.round(d.protein)} g down — muscle repair is covered.`,
        to: '/nutrition',
      })
    }
  } else if (hour >= 11) {
    out.push({
      id: 'nothing-logged',
      tone: 'info',
      icon: 'nutrition',
      title: 'Nothing logged yet today',
      body: 'Tap + to log food by search, photo or voice.',
      to: '/nutrition',
    })
  }

  // --- Hydration pace ----------------------------------------------------------------
  if (d.waterGoalMl > 0 && hour >= 12) {
    const expected = d.waterGoalMl * Math.min(1, Math.max(0.2, (hour - 7) / 14))
    if (d.waterMl < expected * 0.6) {
      const behindMl = Math.round(expected - d.waterMl)
      const behind =
        d.units === 'imperial' ? `${Math.round(mlToFloz(behindMl))} oz` : `${(behindMl / 1000).toFixed(1)} L`
      out.push({
        id: 'water-behind',
        tone: 'info',
        icon: 'hydration',
        title: `About ${behind} behind on water`,
        body: 'Keep a bottle in reach — the + button logs a glass in two taps.',
        to: '/',
      })
    }
  }

  // --- Weight trend ------------------------------------------------------------------
  if (d.weight && d.weight.count >= 6 && Math.abs(d.weight.change) >= 0.5) {
    const losing = d.weight.change < 0
    const unit = weightUnit(d.units)
    out.push({
      id: 'weight-trend',
      tone: losing ? 'good' : 'info',
      icon: 'weight',
      title: `${losing ? 'Down' : 'Up'} ${Math.abs(d.weight.change).toFixed(1)} ${unit} this quarter`,
      body: `Trending ${Math.abs(d.weight.ratePerWeek).toFixed(1)} ${unit}/week ${losing ? 'down' : 'up'} — steady and sustainable.`,
      to: '/progress',
    })
  }

  // --- Streak milestones ---------------------------------------------------------------
  if (d.streak >= 3) {
    out.push({
      id: 'streak',
      tone: 'good',
      icon: 'streak',
      title: `${d.streak}-day logging streak`,
      body: 'Consistency is the whole game — keep it rolling.',
      to: '/nutrition',
    })
  }

  // --- Supplements reminder ------------------------------------------------------------
  if (d.supplements.length > 0 && d.supplementsTaken < d.supplements.length && hour >= 17) {
    const left = d.supplements.length - d.supplementsTaken
    out.push({
      id: 'supplements-left',
      tone: 'info',
      icon: 'supplement',
      title: `${left} supplement${left === 1 ? '' : 's'} left today`,
      body: 'Tick them off from the + button before bed.',
      to: '/',
    })
  }

  return out
}

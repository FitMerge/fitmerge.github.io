// The challenge, shown where the daily habits are.
//
// Collapsed it is one line: where you stand and what today is worth. Tapping it
// expands the board in place, which is the whole interaction — you are already
// looking at the checklist that feeds it, so sending you to another screen to
// see the consequence would be the wrong move.

import { useState } from 'react'
import { ChevronDown, Trophy } from 'lucide-react'
import { Link } from 'react-router-dom'
import { todayISO } from '../../lib/date'
import { activeChallenges, useChallengeStore } from '../../store/challenges'
import { useAuth } from '../../auth/AuthProvider'
import Leaderboard, { TrustNote } from './Leaderboard'
import { useChallengeBoard } from './useChallengeBoard'
import { currentPeriod, dayIndex, periodRange, rankOf, type Challenge } from './scoring'

function ordinal(n: number): string {
  if (n === 0) return '—'
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'
  return `${n}${suffix}`
}

function OneChallenge({ challenge }: { challenge: Challenge }) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const today = todayISO()

  // The board is always scored over the current period, so a weekly-reset
  // challenge shows this week's race rather than a running total nobody can
  // catch up on.
  const period = periodRange(challenge, currentPeriod(challenge, today))
  const { rows, members, myDays, error } = useChallengeBoard(challenge, {
    from: period.start,
    to: period.end,
  })

  const rank = rankOf(rows, user?.uid ?? null)
  const todayScore = myDays[today]
  const day = dayIndex(challenge, today)
  const habitCounts = Object.fromEntries(
    Object.entries(members).map(([uid, m]) => [uid, m.habits.length]),
  )

  return (
    <div className="overflow-hidden rounded-xl bg-slate-800/60">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left"
      >
        <Trophy size={15} className="shrink-0 text-amber-400" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-slate-100">{challenge.name}</span>
          <span className="block truncate text-[11px] text-slate-400">
            {day >= 0 ? `Day ${day + 1}` : `Starts ${challenge.startDate}`}
            {rank > 0 && ` · ${ordinal(rank)} of ${rows.length}`}
            {challenge.periodDays > 0 && ` · ${period.label}`}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-sm font-bold tabular-nums text-slate-100">
            {todayScore?.points ?? 0}
          </span>
          <span className="block text-[10px] text-slate-500">today</span>
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="space-y-2.5 border-t border-slate-700/60 p-3">
          {error ? (
            <p className="text-xs text-rose-400">{error}</p>
          ) : (
            <>
              <Leaderboard rows={rows} habitCounts={habitCounts} />
              <TrustNote />
              <Link
                to={`/challenges/${challenge.code}`}
                className="block text-center text-xs font-medium text-primary-400 active:text-primary-300"
              >
                Open challenge
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Renders nothing unless there is a live challenge — the checklist is the
 * primary thing on this surface and must not grow a permanent empty slot.
 */
export default function ChallengePanel() {
  const joined = useChallengeStore((s) => s.joined)
  const { status } = useAuth()
  const active = activeChallenges(joined, todayISO())

  if (status !== 'signed-in' || active.length === 0) return null

  return (
    <div className="space-y-2">
      {active.map((entry) => (
        <OneChallenge key={entry.challenge.code} challenge={entry.challenge} />
      ))}
    </div>
  )
}

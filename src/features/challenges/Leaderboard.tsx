// The scoreboard. Presentational only — every number arrives already computed.

import { Zap } from 'lucide-react'
import type { StandingRow } from './scoring'

const MEDAL = ['🥇', '🥈', '🥉']

/** "3d ago" — a member whose score hasn't moved in a week is worth noticing. */
function staleness(updatedAt: number | null): string {
  if (!updatedAt) return 'never logged'
  const hours = (Date.now() - updatedAt) / 3_600_000
  if (hours < 1) return 'just now'
  if (hours < 24) return `${Math.floor(hours)}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

type Props = {
  rows: StandingRow[]
  /** Habit count per member, from their published member doc. */
  habitCounts?: Record<string, number>
}

export default function Leaderboard({ rows, habitCounts }: Props) {
  if (rows.length === 0) {
    return <p className="text-xs text-slate-500">Nobody has joined yet. Share the code to get started.</p>
  }

  return (
    <ol className="space-y-1.5">
      {rows.map((row, i) => {
        const habits = habitCounts?.[row.uid]
        return (
          <li
            key={row.uid}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${
              row.isSelf ? 'bg-primary-500/15 ring-1 ring-primary-500/40' : 'bg-slate-900'
            }`}
          >
            <span className="w-6 shrink-0 text-center text-sm font-bold tabular-nums text-slate-400">
              {MEDAL[i] ?? i + 1}
            </span>

            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span
                  className={`truncate text-sm font-medium ${
                    row.hasLeft ? 'text-slate-500 line-through' : 'text-slate-100'
                  }`}
                >
                  {row.displayName}
                </span>
                {row.isSelf && <span className="shrink-0 text-[10px] font-semibold text-primary-400">YOU</span>}
              </span>
              <span className="block truncate text-[11px] text-slate-500">
                {row.perfect} perfect · {row.daysLogged} active
                {habits !== undefined && ` · ${habits} habit${habits === 1 ? '' : 's'}`}
                {' · '}
                {staleness(row.updatedAt)}
              </span>
            </span>

            <span className="shrink-0 text-right">
              <span className="block text-base font-bold tabular-nums text-slate-100">{row.points}</span>
              <span className="block text-[10px] text-slate-500">pts</span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}

/**
 * The honesty note. Scores are self-reported — there is no server that could
 * verify them — so the board's defence is that everything is visible: how many
 * habits someone committed to, how many days they were active, and when they
 * last touched it. Saying so plainly is better than implying an enforcement
 * that doesn't exist.
 */
export function TrustNote() {
  return (
    <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-500">
      <Zap size={11} className="mt-0.5 shrink-0 text-sky-400" />
      <span>
        Everyone ticks their own boxes, so the board runs on trust. Habits that auto-track from Garmin, sleep,
        steps or your food log are the ones nobody can fudge.
      </span>
    </p>
  )
}

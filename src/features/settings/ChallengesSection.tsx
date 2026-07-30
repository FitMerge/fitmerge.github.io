import { Link } from 'react-router-dom'
import { ChevronRight, Trophy } from 'lucide-react'
import Card from '../../components/Card'
import { todayISO } from '../../lib/date'
import { useAuth } from '../../auth/AuthProvider'
import { activeChallenges, useChallengeStore } from '../../store/challenges'

/**
 * The discovery surface for challenges. The day-to-day interaction lives on the
 * daily checklist (see ChallengePanel); this is where you go to start one, join
 * one, or change the name friends see.
 */
export default function ChallengesSection() {
  const { status, usingOwnProject } = useAuth()
  const joined = useChallengeStore((s) => s.joined)
  const displayName = useChallengeStore((s) => s.displayName)
  const setDisplayName = useChallengeStore((s) => s.setDisplayName)
  const active = activeChallenges(joined, todayISO())

  return (
    <Card className="space-y-3">
      <h2 className="font-semibold text-slate-100">Challenges</h2>

      {status !== 'signed-in' ? (
        <p className="text-xs leading-relaxed text-slate-500">
          Sign in above to run a habit challenge with friends.
        </p>
      ) : (
        <>
          <p className="text-xs leading-relaxed text-slate-400">
            Commit to daily habits with friends and score them on a shared board. Everyone picks their own
            habits — weights add up to 100% of your day, so a perfect day is worth the same to everyone.
          </p>

          {usingOwnProject && (
            <p className="rounded-lg bg-amber-500/15 p-2.5 text-[11px] leading-relaxed text-amber-300">
              You're on your own Firebase project, so you can only share challenges with people using that same
              project.
            </p>
          )}

          <label className="block space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Name on the board
            </span>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value.slice(0, 40))}
              placeholder="Josh"
              className="w-full rounded-lg bg-slate-800 px-3 py-2 text-base text-slate-100 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-primary-500"
            />
            {/* Deliberately not the email: the board is readable by anyone with
                the join code. */}
            <span className="block text-[11px] text-slate-500">
              This is what other people in a challenge see.
            </span>
          </label>

          <Link
            to="/challenges"
            className="flex items-center gap-2.5 rounded-lg bg-slate-800/60 px-3 py-2.5 active:bg-slate-800"
          >
            <Trophy size={15} className="shrink-0 text-amber-400" />
            <span className="min-w-0 flex-1 text-sm text-slate-100">
              {joined.length === 0
                ? 'Create or join a challenge'
                : `${joined.length} challenge${joined.length === 1 ? '' : 's'}`}
              {active.length > 0 && (
                <span className="block text-[11px] text-slate-500">{active.length} running now</span>
              )}
            </span>
            <ChevronRight size={16} className="shrink-0 text-slate-500" />
          </Link>
        </>
      )}
    </Card>
  )
}

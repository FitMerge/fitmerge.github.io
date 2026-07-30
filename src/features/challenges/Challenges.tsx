import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Plus, Trophy, Users } from 'lucide-react'
import Button from '../../components/Button'
import Card from '../../components/Card'
import EmptyState from '../../components/EmptyState'
import { isoToLabel, todayISO } from '../../lib/date'
import { useAuth } from '../../auth/AuthProvider'
import { useChallengeStore } from '../../store/challenges'
import CreateChallengeSheet from './CreateChallengeSheet'
import JoinChallengeSheet from './JoinChallengeSheet'
import { formatCode } from './joinCode'
import { dayIndex, isActive } from './scoring'

export default function Challenges() {
  const navigate = useNavigate()
  // `/challenges/join/:code` reuses this page and opens the join sheet straight
  // away, so an invite link is a single tap from a message.
  const { code: inviteCode } = useParams<{ code: string }>()
  const { status, usingOwnProject } = useAuth()
  const joined = useChallengeStore((s) => s.joined)
  const [creating, setCreating] = useState(false)
  const [joining, setJoining] = useState(inviteCode !== undefined)
  const today = todayISO()

  if (status !== 'signed-in') {
    return (
      <div className="space-y-4 p-4">
        <h1 className="text-xl font-bold text-slate-100">Challenges</h1>
        <EmptyState
          icon={Trophy}
          title="Sign in to run a challenge"
          subtitle="Challenges are shared with friends, so they need an account. Sign in from Settings."
        />
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-xl font-bold text-slate-100">Challenges</h1>

      {/* A device that pasted its own Firebase config is in a different database
          entirely, so every code lookup would fail with a baffling "not found". */}
      {usingOwnProject && (
        <p className="rounded-xl bg-amber-500/15 p-3 text-xs leading-relaxed text-amber-300">
          You're signed in to your own Firebase project, so you can only share challenges with people using
          that same project.
        </p>
      )}

      {joined.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="No challenges yet"
          subtitle="Set up a run of daily habits with friends, or join one with a code. Everyone picks their own habits — the scoring keeps it fair."
        />
      ) : (
        <div className="space-y-2">
          {joined.map((entry) => {
            const { challenge } = entry
            const day = dayIndex(challenge, today)
            const live = isActive(challenge, today) && entry.leftAt === undefined
            return (
              <Link
                key={challenge.code}
                to={`/challenges/${challenge.code}`}
                className="block rounded-xl bg-slate-900 p-3 active:bg-slate-800"
              >
                <div className="flex items-center gap-2.5">
                  <Trophy size={16} className={live ? 'text-amber-400' : 'text-slate-600'} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-100">{challenge.name}</span>
                    <span className="block truncate text-[11px] text-slate-500">
                      {isoToLabel(challenge.startDate)} → {isoToLabel(challenge.endDate)}
                      {live && day >= 0 && ` · Day ${day + 1}`}
                      {entry.leftAt !== undefined && ' · left'}
                      {!live && entry.leftAt === undefined && ' · finished'}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-[11px] text-slate-500">
                    {formatCode(challenge.code)}
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      <Card>
        <div className="flex gap-2">
          <Button variant="primary" full onClick={() => setCreating(true)}>
            <span className="flex items-center justify-center gap-1.5">
              <Plus size={15} /> New
            </span>
          </Button>
          <Button variant="ghost" full onClick={() => setJoining(true)}>
            <span className="flex items-center justify-center gap-1.5">
              <Users size={15} /> Join with a code
            </span>
          </Button>
        </div>
      </Card>

      <CreateChallengeSheet
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(code) => navigate(`/challenges/${code}`)}
      />
      <JoinChallengeSheet
        open={joining}
        onClose={() => {
          setJoining(false)
          if (inviteCode) navigate('/challenges', { replace: true })
        }}
        onJoined={(code) => navigate(`/challenges/${code}`)}
        initialCode={inviteCode}
      />
    </div>
  )
}

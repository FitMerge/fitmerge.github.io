import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Check, ChevronLeft, Copy, Trophy } from 'lucide-react'
import Button from '../../components/Button'
import Card from '../../components/Card'
import SegmentedControl from '../../components/SegmentedControl'
import { isoToLabel, todayISO } from '../../lib/date'
import { useAuth } from '../../auth/AuthProvider'
import { findJoined, useChallengeStore } from '../../store/challenges'
import { useSupplementStore } from '../../store/supplements'
import Leaderboard, { TrustNote } from './Leaderboard'
import HabitWeightEditor from './HabitWeightEditor'
import InviteManager from './InviteManager'
import { useChallengeBoard } from './useChallengeBoard'
import { archiveChallenge, fetchChallenge, leaveChallenge, upsertMember } from './challengeRepo'
import { formatCode, inviteLink } from './joinCode'
import {
  challengeLength,
  currentPeriod,
  dayIndex,
  perfectDays,
  periodRange,
  sumPoints,
  type Challenge,
} from './scoring'
import { isBalanced, pruneWeights, type WeightMap } from './weights'

type Scope = 'period' | 'all'

export default function ChallengeDetail() {
  const { code = '' } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const joined = useChallengeStore((s) => s.joined)
  const cacheChallenge = useChallengeStore((s) => s.cacheChallenge)
  const setStoredWeights = useChallengeStore((s) => s.setWeights)
  const leaveLocal = useChallengeStore((s) => s.leave)
  const displayName = useChallengeStore((s) => s.displayName)
  const items = useSupplementStore((s) => s.items)

  const entry = findJoined(joined, code)
  const [remote, setRemote] = useState<Challenge | null>(null)
  const challenge = entry?.challenge ?? remote
  const today = todayISO()

  const [scope, setScope] = useState<Scope>('period')
  const [copied, setCopied] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<WeightMap>({})
  const [busy, setBusy] = useState(false)

  // Refresh the cached definition — a name change or an archive by the owner
  // should show up without needing to re-join.
  useEffect(() => {
    if (!code) return
    void fetchChallenge(code)
      .then((c) => {
        if (!c) return
        setRemote(c)
        cacheChallenge(c)
      })
      .catch(() => {
        // Offline or rules not deployed; the cached copy still renders.
      })
  }, [code, cacheChallenge])

  const periodIndex = challenge ? currentPeriod(challenge, today) : 0
  const period = challenge ? periodRange(challenge, periodIndex) : null
  const showPeriod = Boolean(challenge && challenge.periodDays > 0 && scope === 'period')
  const range = showPeriod && period ? { from: period.start, to: period.end } : null

  const { rows, members, myDays, error } = useChallengeBoard(challenge, range)

  const habitCounts = useMemo(
    () => Object.fromEntries(Object.entries(members).map(([uid, m]) => [uid, m.habits.length])),
    [members],
  )

  if (!challenge) {
    return (
      <div className="space-y-4 p-4">
        <BackLink />
        <p className="text-sm text-slate-400">Loading challenge {formatCode(code)}…</p>
      </div>
    )
  }

  const day = dayIndex(challenge, today)
  const myPoints = sumPoints(myDays, range?.from, range?.to)
  const myPerfect = perfectDays(myDays, range?.from, range?.to)
  const isOwner = user?.uid === challenge.ownerUid

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(inviteLink(code))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard blocked (insecure context / permissions) — the code is on
      // screen anyway, so this is a convenience, not the only way to share.
    }
  }

  async function saveWeights() {
    if (!user || !entry || !isBalanced(draft)) return
    setBusy(true)
    try {
      setStoredWeights(code, draft)
      await upsertMember(code, user.uid, {
        displayName: displayName || 'You',
        joinedAt: entry.joinedAt,
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
        habits: Object.entries(draft).map(([id, weight]) => ({
          name: items.find((i) => i.id === id)?.name ?? 'Habit',
          weight,
        })),
      })
      setEditing(false)
    } finally {
      setBusy(false)
    }
  }

  async function doLeave() {
    if (!user || !entry) return
    setBusy(true)
    try {
      await leaveChallenge(code, user.uid, {
        displayName: displayName || 'You',
        joinedAt: entry.joinedAt,
        habits: Object.entries(entry.weights).map(([id, weight]) => ({
          name: items.find((i) => i.id === id)?.name ?? 'Habit',
          weight,
        })),
      })
      leaveLocal(code)
      navigate('/challenges')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4 p-4">
      <BackLink />

      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-100">
          <Trophy size={18} className="text-amber-400" />
          {challenge.name}
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          {isoToLabel(challenge.startDate)} → {isoToLabel(challenge.endDate)} · {challengeLength(challenge)} days
          {day >= 0 && ` · Day ${day + 1}`}
        </p>
      </div>

      <Card className="flex items-center justify-between">
        <span>
          <span className="block font-mono text-lg font-bold tracking-widest text-slate-100">
            {formatCode(code)}
          </span>
          {/* The code is a shortcut to the right challenge, not a credential —
              access is the guest list below. Saying so stops the organiser
              assuming a forwarded link is enough (or that it's a leak). */}
          <span className="block text-[11px] text-slate-500">Send to people you've invited</span>
        </span>
        <Button variant="ghost" onClick={copyInvite}>
          <span className="flex items-center gap-1.5 text-sm">
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied' : 'Copy link'}
          </span>
        </Button>
      </Card>

      <Card>
        <InviteManager code={code} canEdit={isOwner} memberCount={Object.keys(members).length} />
      </Card>

      <Card className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-slate-100">Scoreboard</h2>
          {challenge.periodDays > 0 && period && (
            <SegmentedControl
              options={[
                { key: 'period' as const, label: period.label },
                { key: 'all' as const, label: 'All time' },
              ]}
              value={scope}
              onChange={setScope}
              size="sm"
              ariaLabel="Scoreboard range"
            />
          )}
        </div>

        {error ? (
          <p className="text-xs text-rose-400">{error}</p>
        ) : (
          <>
            <Leaderboard rows={rows} habitCounts={habitCounts} />
            <TrustNote />
          </>
        )}
      </Card>

      <Card className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-100">You</h2>
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat label="points" value={myPoints} />
          <Stat label="perfect days" value={myPerfect} />
          <Stat label="today" value={myDays[today]?.points ?? 0} />
        </div>
      </Card>

      {entry && entry.leftAt === undefined && (
        <Card className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-slate-100">Your habits</h2>
            {!editing && (
              <button
                type="button"
                onClick={() => {
                  setDraft(
                    pruneWeights(
                      entry.weights,
                      items.map((i) => i.id),
                    ),
                  )
                  setEditing(true)
                }}
                className="text-xs font-medium text-primary-400"
              >
                Edit
              </button>
            )}
          </div>

          {editing ? (
            <>
              <HabitWeightEditor weights={draft} onChange={setDraft} />
              <div className="flex gap-2">
                <Button variant="primary" full onClick={saveWeights} disabled={!isBalanced(draft) || busy}>
                  Save
                </Button>
                <Button variant="ghost" full onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </div>
              {/* Changing weights restates only the last week of scores — older
                  days stay as they were published, so this can't rewrite history. */}
              <p className="text-[11px] text-slate-500">
                New weights apply from today. Days already scored stay as they were.
              </p>
            </>
          ) : (
            <ul className="space-y-1">
              {Object.entries(entry.weights).map(([id, weight]) => (
                <li key={id} className="flex items-center justify-between text-xs">
                  <span className="truncate text-slate-300">
                    {items.find((i) => i.id === id)?.name ?? 'Removed habit'}
                  </span>
                  <span className="shrink-0 tabular-nums text-slate-500">{weight}%</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <div className="flex gap-2">
        {entry && entry.leftAt === undefined && (
          <Button variant="ghost" full onClick={doLeave} disabled={busy}>
            Leave challenge
          </Button>
        )}
        {isOwner && !challenge.archived && (
          <Button
            variant="ghost"
            full
            disabled={busy}
            onClick={() => {
              setBusy(true)
              void archiveChallenge(code)
                .then(() => navigate('/challenges'))
                .finally(() => setBusy(false))
            }}
          >
            Close challenge
          </Button>
        )}
      </div>

      {entry && entry.leftAt === undefined && (
        <p className="text-[11px] leading-relaxed text-slate-500">
          Leaving keeps your final score on the board.
        </p>
      )}
    </div>
  )
}

function BackLink() {
  return (
    <Link to="/challenges" className="flex items-center gap-1 text-sm text-slate-400 active:text-slate-200">
      <ChevronLeft size={16} /> Challenges
    </Link>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-slate-800/60 py-2.5">
      <p className="text-lg font-bold tabular-nums text-slate-100">{value}</p>
      <p className="text-[10px] text-slate-500">{label}</p>
    </div>
  )
}

import { useState } from 'react'
import Button from '../../components/Button'
import Sheet from '../../components/Sheet'
import SegmentedControl from '../../components/SegmentedControl'
import { addDays, todayISO } from '../../lib/date'
import { useAuth } from '../../auth/AuthProvider'
import { useChallengeStore } from '../../store/challenges'
import { useSupplementStore } from '../../store/supplements'
import HabitWeightEditor from './HabitWeightEditor'
import { createChallenge, inviteEmail, upsertMember, ChallengeError } from './challengeRepo'
import { normalizeEmail, parseEmailList } from './invites'
import { generateJoinCode } from './joinCode'
import { DEFAULT_BONUS_PCT, type Challenge } from './scoring'
import { equalSplit, isBalanced, type WeightMap } from './weights'

type Reset = 'none' | 'weekly' | 'monthly'
const RESETS = [
  { key: 'none' as const, label: 'Never' },
  { key: 'weekly' as const, label: 'Weekly' },
  { key: 'monthly' as const, label: 'Monthly' },
]
const PERIOD_DAYS: Record<Reset, 0 | 7 | 28> = { none: 0, weekly: 7, monthly: 28 }

type Props = {
  open: boolean
  onClose: () => void
  onCreated: (code: string) => void
}

export default function CreateChallengeSheet({ open, onClose, onCreated }: Props) {
  const { user } = useAuth()
  const items = useSupplementStore((s) => s.items)
  const join = useChallengeStore((s) => s.join)
  const storedName = useChallengeStore((s) => s.displayName)
  const setDisplayName = useChallengeStore((s) => s.setDisplayName)

  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState(todayISO())
  const [endDate, setEndDate] = useState(addDays(todayISO(), 29))
  const [reset, setReset] = useState<Reset>('none')
  const [bonus, setBonus] = useState(true)
  const [nickname, setNickname] = useState(storedName || user?.displayName || '')
  // Invites can be added later on the challenge page; offering them here means
  // the common case is one screen rather than two.
  const [inviteText, setInviteText] = useState('')
  // Everything selected at an even split is the sane starting point; most people
  // will just accept it.
  const [weights, setWeights] = useState<WeightMap>(() => equalSplit(items.map((i) => i.id)))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const canCreate =
    name.trim().length > 0 &&
    nickname.trim().length > 0 &&
    endDate >= startDate &&
    isBalanced(weights) &&
    !busy

  async function submit() {
    if (!user || !canCreate) return
    const { valid: inviteEmails, invalid } = parseEmailList(inviteText)
    if (invalid.length > 0) {
      setError(`Doesn't look like an email address: ${invalid.join(', ')}`)
      return
    }
    setBusy(true)
    setError('')
    const challenge: Challenge = {
      code: generateJoinCode(),
      name: name.trim(),
      ownerUid: user.uid,
      startDate,
      endDate,
      periodDays: PERIOD_DAYS[reset],
      bonusPct: bonus ? DEFAULT_BONUS_PCT : 0,
    }
    try {
      // Creating also puts the organiser on the guest list — writing a member
      // document requires being invited, so that has to land first.
      await createChallenge(challenge, normalizeEmail(user.email ?? ''))
      for (const email of inviteEmails) {
        await inviteEmail(challenge.code, email, user.uid)
      }
      await upsertMember(challenge.code, user.uid, {
        displayName: nickname.trim(),
        joinedAt: Date.now(),
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
        habits: Object.entries(weights).map(([id, weight]) => ({
          name: items.find((i) => i.id === id)?.name ?? 'Habit',
          weight,
        })),
      })
      setDisplayName(nickname.trim())
      join(challenge, weights)
      onCreated(challenge.code)
      onClose()
    } catch (err) {
      setError(err instanceof ChallengeError ? err.message : "Couldn't create the challenge.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="New challenge">
      <div className="space-y-4">
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-slate-400">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 60))}
            placeholder="Iron August"
            className="w-full rounded-lg bg-slate-800 px-3 py-2 text-base text-slate-100 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-primary-500"
          />
        </label>

        <div className="flex gap-2">
          <label className="flex-1 space-y-1.5">
            <span className="text-xs font-medium text-slate-400">Starts</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg bg-slate-800 px-3 py-2 text-base text-slate-100 outline-none focus:ring-2 focus:ring-primary-500"
            />
          </label>
          <label className="flex-1 space-y-1.5">
            <span className="text-xs font-medium text-slate-400">Ends</span>
            <input
              type="date"
              value={endDate}
              min={startDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-lg bg-slate-800 px-3 py-2 text-base text-slate-100 outline-none focus:ring-2 focus:ring-primary-500"
            />
          </label>
        </div>

        <div className="space-y-1.5">
          <span className="text-xs font-medium text-slate-400">Points reset</span>
          <SegmentedControl options={RESETS} value={reset} onChange={setReset} size="sm" ariaLabel="Points reset" />
          <p className="text-[11px] text-slate-500">
            {reset === 'none'
              ? 'One running total for the whole challenge.'
              : `A fresh leaderboard every ${reset === 'weekly' ? '7' : '28'} days, counted from the start date. Your full history is kept either way.`}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setBonus(!bonus)}
          className="flex w-full items-center justify-between rounded-lg bg-slate-800/60 px-3 py-2.5 text-left"
        >
          <span>
            <span className="block text-sm text-slate-100">Perfect-day bonus</span>
            <span className="block text-[11px] text-slate-500">+10% when you complete every habit</span>
          </span>
          <span
            className={`h-5 w-9 shrink-0 rounded-full p-0.5 transition ${bonus ? 'bg-primary-500' : 'bg-slate-700'}`}
          >
            <span className={`block h-4 w-4 rounded-full bg-white transition ${bonus ? 'translate-x-4' : ''}`} />
          </span>
        </button>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-slate-400">Your name on the board</span>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value.slice(0, 40))}
            placeholder="Josh"
            className="w-full rounded-lg bg-slate-800 px-3 py-2 text-base text-slate-100 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-primary-500"
          />
        </label>

        <div className="space-y-1.5 border-t border-slate-800 pt-3">
          <span className="text-sm font-semibold text-slate-100">Invite people</span>
          <textarea
            value={inviteText}
            onChange={(e) => setInviteText(e.target.value)}
            placeholder="friend@gmail.com, other@gmail.com"
            rows={2}
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="w-full resize-none rounded-lg bg-slate-800 px-3 py-2 text-base text-slate-100 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-primary-500"
          />
          {/* This is the access control, not a notification — worth being blunt
              about, or the organiser will assume sharing the code is enough. */}
          <p className="text-[11px] leading-relaxed text-slate-500">
            Only people on this list can open the challenge — the code alone won't let anyone in. Use the email
            they sign in with. You can add more later.
          </p>
        </div>

        <div className="space-y-2 border-t border-slate-800 pt-3">
          <p className="text-sm font-semibold text-slate-100">Your habits</p>
          <HabitWeightEditor weights={weights} onChange={setWeights} />
        </div>

        {error && <p className="text-xs text-rose-400">{error}</p>}

        <Button variant="primary" full onClick={submit} disabled={!canCreate}>
          {busy ? 'Creating…' : 'Create challenge'}
        </Button>
      </div>
    </Sheet>
  )
}

import { useEffect, useState } from 'react'
import { Calendar, Users } from 'lucide-react'
import Button from '../../components/Button'
import Sheet from '../../components/Sheet'
import { isoToLabel } from '../../lib/date'
import { useAuth } from '../../auth/AuthProvider'
import { useChallengeStore } from '../../store/challenges'
import { useSupplementStore } from '../../store/supplements'
import HabitWeightEditor from './HabitWeightEditor'
import { ChallengeAccessError, ChallengeError, fetchChallenge, upsertMember } from './challengeRepo'
import { formatCode, isValidCode, normalizeCode } from './joinCode'
import { challengeLength, type Challenge } from './scoring'
import { equalSplit, isBalanced, type WeightMap } from './weights'

type Props = {
  open: boolean
  onClose: () => void
  onJoined: (code: string) => void
  /** Pre-filled from an invite link, so the code step is skipped entirely. */
  initialCode?: string
}

export default function JoinChallengeSheet({ open, onClose, onJoined, initialCode }: Props) {
  const { user } = useAuth()
  const items = useSupplementStore((s) => s.items)
  const join = useChallengeStore((s) => s.join)
  const storedName = useChallengeStore((s) => s.displayName)
  const setDisplayName = useChallengeStore((s) => s.setDisplayName)

  const [code, setCode] = useState(initialCode ?? '')
  const [found, setFound] = useState<Challenge | null>(null)
  const [nickname, setNickname] = useState(storedName || user?.displayName || '')
  const [weights, setWeights] = useState<WeightMap>(() => equalSplit(items.map((i) => i.id)))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // An invite link lands here with the code already known — look it up straight
  // away so the first thing the user sees is the challenge, not a form.
  useEffect(() => {
    if (!open || !initialCode) return
    setCode(initialCode)
    void lookup(initialCode)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialCode])

  async function lookup(raw: string) {
    const normalized = normalizeCode(raw)
    if (!isValidCode(normalized)) {
      setError('That code doesn’t look right — it’s 8 characters.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const challenge = await fetchChallenge(normalized)
      if (!challenge) {
        setError('No challenge with that code. Check it with whoever invited you.')
        return
      }
      if (challenge.archived) {
        setError('That challenge has been closed.')
        return
      }
      setFound(challenge)
    } catch (err) {
      // Challenges are invite-only, so a refusal here nearly always means this
      // account isn't on the guest list — but a non-existent code is refused
      // the same way, and the rules can't tell us which. Say both.
      if (err instanceof ChallengeAccessError) {
        setError(
          user?.email
            ? `Either that code is wrong, or ${user.email} hasn't been invited. Ask the organiser to add it.`
            : "Either that code is wrong, or you haven't been invited to this challenge.",
        )
        return
      }
      setError(err instanceof ChallengeError ? err.message : "Couldn't look that code up.")
    } finally {
      setBusy(false)
    }
  }

  async function confirm() {
    if (!user || !found) return
    setBusy(true)
    setError('')
    try {
      await upsertMember(found.code, user.uid, {
        displayName: nickname.trim(),
        joinedAt: Date.now(),
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
        habits: Object.entries(weights).map(([id, weight]) => ({
          name: items.find((i) => i.id === id)?.name ?? 'Habit',
          weight,
        })),
      })
      setDisplayName(nickname.trim())
      join(found, weights)
      onJoined(found.code)
      onClose()
    } catch (err) {
      setError(err instanceof ChallengeError ? err.message : "Couldn't join the challenge.")
    } finally {
      setBusy(false)
    }
  }

  const canConfirm = nickname.trim().length > 0 && isBalanced(weights) && !busy

  return (
    <Sheet open={open} onClose={onClose} title={found ? 'Join challenge' : 'Enter a code'}>
      {!found ? (
        <div className="space-y-3">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="AB34CD78"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            className="w-full rounded-lg bg-slate-800 px-3 py-3 text-center text-xl font-bold tracking-[0.2em] text-slate-100 placeholder:text-slate-600 placeholder:tracking-normal outline-none focus:ring-2 focus:ring-primary-500"
          />
          {error && <p className="text-xs text-rose-400">{error}</p>}
          <Button variant="primary" full onClick={() => void lookup(code)} disabled={busy || code.trim() === ''}>
            {busy ? 'Looking…' : 'Find challenge'}
          </Button>
          <p className="text-[11px] leading-relaxed text-slate-500">
            Challenges are invite-only. The organiser needs to have added
            {user?.email ? ` ${user.email}` : ' your email'} before this will work.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl bg-slate-800/60 p-3">
            <p className="text-base font-bold text-slate-100">{found.name}</p>
            <p className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400">
              <Calendar size={11} />
              {isoToLabel(found.startDate)} → {isoToLabel(found.endDate)} · {challengeLength(found)} days
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-400">
              <Users size={11} />
              Code {formatCode(found.code)}
            </p>
          </div>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-slate-400">Your name on the board</span>
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value.slice(0, 40))}
              placeholder="Josh"
              className="w-full rounded-lg bg-slate-800 px-3 py-2 text-base text-slate-100 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-primary-500"
            />
          </label>

          <div className="space-y-2 border-t border-slate-800 pt-3">
            <p className="text-sm font-semibold text-slate-100">Your habits</p>
            <p className="text-[11px] leading-relaxed text-slate-500">
              You pick your own — nobody has to run the same list. Because the weights add up to 100% of your
              day, a perfect day is worth the same to everyone.
            </p>
            <HabitWeightEditor weights={weights} onChange={setWeights} />
          </div>

          {error && <p className="text-xs text-rose-400">{error}</p>}

          <Button variant="primary" full onClick={confirm} disabled={!canConfirm}>
            {busy ? 'Joining…' : `Join ${found.name}`}
          </Button>
        </div>
      )}
    </Sheet>
  )
}

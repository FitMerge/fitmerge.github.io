// The guest list, for the organiser.
//
// Adding an email here is what actually grants access — the join code alone
// gets nobody in. That makes this the security control, not a convenience, so
// it says plainly who can see the board and shows who has and hasn't joined.

import { useEffect, useState } from 'react'
import { Check, Mail, Trash2, UserPlus } from 'lucide-react'
import Button from '../../components/Button'
import { useAuth } from '../../auth/AuthProvider'
import { ChallengeError, inviteEmail, revokeInvite, watchInvites, type InviteDoc } from './challengeRepo'
import { emailLabel, parseEmailList } from './invites'

type Props = {
  code: string
  /** Only the organiser may edit; everyone invited can see the list. */
  canEdit: boolean
  /** Emails of people who have actually joined, to mark the roster. */
  joinedEmails?: Set<string>
  /** Member count, so the list can say who is still outstanding. */
  memberCount: number
}

export default function InviteManager({ code, canEdit, memberCount }: Props) {
  const { user } = useAuth()
  const [invites, setInvites] = useState<InviteDoc[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let stop: (() => void) | null = null
    let cancelled = false
    void watchInvites(
      code,
      (list) => {
        if (cancelled) return
        setInvites(list)
        setLoaded(true)
      },
      (err) => {
        if (cancelled) return
        setError(err.message)
        setLoaded(true)
      },
    )
      .then((unsub) => {
        if (cancelled) unsub()
        else stop = unsub
      })
      .catch(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
      stop?.()
    }
  }, [code])

  async function add() {
    const { valid, invalid } = parseEmailList(input)
    if (invalid.length > 0) {
      setError(`Doesn't look like an email address: ${invalid.join(', ')}`)
      return
    }
    if (valid.length === 0) return

    setBusy(true)
    setError('')
    try {
      for (const email of valid) {
        await inviteEmail(code, email, user?.uid ?? '')
      }
      setInput('')
    } catch (err) {
      setError(err instanceof ChallengeError ? err.message : "Couldn't send that invite.")
    } finally {
      setBusy(false)
    }
  }

  async function remove(email: string) {
    setBusy(true)
    setError('')
    try {
      await revokeInvite(code, email)
    } catch (err) {
      setError(err instanceof ChallengeError ? err.message : "Couldn't remove that person.")
    } finally {
      setBusy(false)
    }
  }

  const outstanding = invites.length - memberCount

  return (
    <div className="space-y-2.5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-slate-100">Who's invited</h2>
        {loaded && invites.length > 0 && (
          <span className="text-[11px] text-slate-500">
            {invites.length} invited
            {outstanding > 0 && ` · ${outstanding} not joined yet`}
          </span>
        )}
      </div>

      <p className="text-[11px] leading-relaxed text-slate-500">
        Only these people can open this challenge. The code on its own won't let anyone in.
      </p>

      {invites.length === 0 && loaded && (
        <p className="text-xs text-slate-500">Nobody invited yet.</p>
      )}

      <ul className="space-y-1">
        {invites.map((invite) => {
          const isSelf = user?.email != null && invite.email === user.email.toLowerCase()
          return (
            <li key={invite.email} className="flex items-center gap-2.5 rounded-lg bg-slate-800/60 px-3 py-2">
              <Mail size={13} className="shrink-0 text-slate-500" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs text-slate-200">{emailLabel(invite.email)}</span>
                <span className="block truncate text-[10px] text-slate-500">{invite.email}</span>
              </span>
              {isSelf && <span className="shrink-0 text-[10px] font-semibold text-primary-400">YOU</span>}
              {canEdit && !isSelf && (
                <button
                  type="button"
                  onClick={() => void remove(invite.email)}
                  disabled={busy}
                  aria-label={`Remove ${invite.email}`}
                  className="shrink-0 p-1 text-slate-600 active:text-rose-400"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </li>
          )
        })}
      </ul>

      {canEdit && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="friend@gmail.com"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="min-w-0 flex-1 rounded-lg bg-slate-800 px-3 py-2 text-base text-slate-100 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-primary-500"
            />
            <Button variant="ghost" onClick={add} disabled={busy || input.trim() === ''}>
              <span className="flex items-center gap-1.5 text-sm">
                <UserPlus size={14} /> Invite
              </span>
            </Button>
          </div>
          <p className="text-[11px] text-slate-500">
            Use the Google account email they sign in with. You can paste several at once.
          </p>
        </div>
      )}

      {error && <p className="text-xs text-rose-400">{error}</p>}
      {!error && !canEdit && (
        <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
          <Check size={11} className="text-primary-400" /> Only the organiser can change this list.
        </p>
      )}
    </div>
  )
}

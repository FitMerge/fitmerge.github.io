import { useEffect, useState } from 'react'
import { CheckCircle2, Loader2, RefreshCw, Watch, XCircle } from 'lucide-react'
import Card from '../../components/Card'
import Button from '../../components/Button'
import { useGarminLink } from './useGarminLink'

function timeAgo(ts: number): string {
  const s = Math.round((Date.now() - ts) / 1000)
  if (s < 60) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h ago`
  return `${Math.round(h / 24)} d ago`
}

const INPUT =
  'w-full rounded-lg bg-slate-800 px-3 py-2.5 text-base text-slate-100 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-primary-500'

/** How long the current connection attempt has been waiting, in plain words. */
function elapsedLabel(since: number): string {
  const s = Math.max(0, Math.round((Date.now() - since) / 1000))
  if (s < 60) return `${s}s so far`
  const m = Math.floor(s / 60)
  return `${m} min ${s % 60}s so far`
}

/**
 * Connect Garmin without touching GitHub, secrets or a service account: the
 * login is sealed in this browser and opened only by the scheduled sync job.
 * Deliberately written for someone who has never heard the word "API".
 */
export default function GarminConnectSection() {
  const {
    available,
    signedIn,
    status,
    busy,
    error,
    connect,
    sendMfaCode,
    syncNow,
    disconnect,
    canStartWorker,
    workerStarted,
    waitingSince,
    startWorker,
  } = useGarminLink()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [understood, setUnderstood] = useState(false)

  // Re-render once a second while waiting so the elapsed time actually counts up.
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!waitingSince) return
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [waitingSince])

  if (!available) {
    // Nothing actionable without an account, so say why rather than showing a
    // form that cannot work.
    return (
      <Card className="space-y-2">
        <div className="flex items-center gap-2">
          <Watch size={16} className="text-primary-400" />
          <h2 className="text-sm font-semibold text-slate-200">Garmin watch</h2>
        </div>
        <p className="text-sm text-slate-400">
          {signedIn
            ? 'Garmin syncing isn’t switched on in this version of the app yet.'
            : 'Sign in above first, then you can connect your Garmin watch here.'}
        </p>
      </Card>
    )
  }

  const { state } = status
  const connected = state === 'linked'
  const working = state === 'pending' || busy

  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-2">
        <Watch size={16} className="text-primary-400" />
        <h2 className="text-sm font-semibold text-slate-200">Garmin watch</h2>
      </div>

      {connected && (
        <>
          <p className="flex items-center gap-1.5 text-sm text-emerald-400">
            <CheckCircle2 size={15} />
            Connected{status.email ? ` as ${status.email}` : ''}
          </p>
          <p className="text-xs text-slate-500">
            Your steps, sleep, heart rate and workouts update on their own.
            {status.lastSyncAt ? ` Last updated ${timeAgo(status.lastSyncAt)}.` : ''}
          </p>
          <Button variant="ghost" full onClick={() => void syncNow()} disabled={busy}>
            <span className="flex items-center justify-center gap-1.5">
              <RefreshCw size={16} className={busy ? 'animate-spin' : undefined} />
              Update now
            </span>
          </Button>
          <button
            type="button"
            onClick={() => void disconnect()}
            className="w-full text-xs text-slate-500 underline"
          >
            Disconnect Garmin
          </button>
        </>
      )}

      {state === 'needs_mfa' && (
        <div className="space-y-2">
          <p className="text-sm text-slate-200">Garmin sent you a code — enter it here.</p>
          <p className="text-xs text-slate-500">Check your email or your authenticator app.</p>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123456"
            inputMode="numeric"
            autoComplete="one-time-code"
            className={INPUT}
          />
          <Button variant="primary" full onClick={() => void sendMfaCode(code)} disabled={busy || !code.trim()}>
            {busy ? 'Checking…' : 'Continue'}
          </Button>
        </div>
      )}

      {working && state !== 'needs_mfa' && (
        <div className="space-y-2">
          <p className="flex items-start gap-1.5 text-sm text-slate-400">
            <Loader2 size={15} className="mt-0.5 shrink-0 animate-spin text-primary-400" />
            <span>
              Connecting…{waitingSince ? ` ${elapsedLabel(waitingSince)}.` : ''} You can leave this
              screen open — you may need to enter a code.
            </span>
          </p>

          {/* The worker runs on a schedule, but GitHub's short crons skip often
              enough that waiting on one looks indistinguishable from a hang.
              Whoever holds a token can start it now; everyone else is told what
              is actually happening rather than watching a bare spinner. */}
          {canStartWorker ? (
            workerStarted ? (
              <p className="text-xs text-slate-500">
                Sync job started — this usually finishes within a minute or two.
              </p>
            ) : (
              <Button variant="ghost" full onClick={() => void startWorker()} disabled={busy}>
                Start the sync job now
              </Button>
            )
          ) : (
            <p className="text-xs text-slate-500">
              The sync job runs every few minutes and will pick this up on its own. If it is still
              going after about ten minutes, ask whoever set up the app to start it.
            </p>
          )}
        </div>
      )}

      {!connected && !working && state !== 'needs_mfa' && (
        <>
          {(state === 'error' || state === 'needs_relink') && status.message && (
            <p className="flex items-start gap-1.5 text-sm text-amber-300">
              <XCircle size={15} className="mt-0.5 shrink-0" />
              {status.message}
            </p>
          )}

          <p className="text-sm text-slate-400">
            Sign in with your Garmin account and your steps, sleep, heart rate and workouts will show
            up here automatically.
          </p>

          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Garmin email"
            type="email"
            autoCapitalize="none"
            autoCorrect="off"
            className={INPUT}
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Garmin password"
            type="password"
            autoCapitalize="none"
            autoCorrect="off"
            className={INPUT}
          />

          {/* Garmin offers no "connect an app" option, so this really is a
              sign-in on the user's behalf. Say so plainly, before the button. */}
          <label className="flex items-start gap-2 text-xs text-slate-400">
            <input
              type="checkbox"
              checked={understood}
              onChange={(e) => setUnderstood(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-primary-500"
            />
            <span>
              Garmin has no “connect an app” button, so FitMerge signs in as you to fetch your data.
              Your login is encrypted on this device and swapped for a temporary pass as soon as it
              works. You can disconnect any time.
            </span>
          </label>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <Button
            variant="primary"
            full
            onClick={() => void connect(email, password)}
            disabled={busy || !understood || !email.trim() || !password}
          >
            {busy ? 'Connecting…' : 'Connect'}
          </Button>
        </>
      )}
    </Card>
  )
}

import { useState } from 'react'
import { Check, ChevronDown, ChevronUp, Cloud, Copy, LogIn, LogOut, Mail, RefreshCw } from 'lucide-react'
import Card from '../../components/Card'
import Button from '../../components/Button'
import { useAuth } from '../../auth/AuthProvider'

const FIRESTORE_RULES = `match /users/{uid}/{doc=**} {
  allow read, write: if request.auth != null && request.auth.uid == uid;
}`

// The domain a user must allow-list in Firebase Auth is simply wherever they're
// reading this from, so read it off the page rather than hardcoding a host that
// goes stale the moment the app moves. Localhost is already trusted by Firebase
// by default, so fall back to the public host when running locally.
const AUTH_DOMAIN_HINT =
  typeof window !== 'undefined' && !/^(localhost|127\.0\.0\.1)$/.test(window.location.hostname)
    ? window.location.hostname
    : 'fitmerge.github.io'

export default function SyncSection() {
  const {
    user,
    status,
    syncState,
    configured,
    usingOwnProject,
    lastSyncedAt,
    signIn,
    signOut,
    refresh,
    connect,
    disconnect,
  } = useAuth()
  const [advancedOpen, setAdvancedOpen] = useState(false)

  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-2">
        <Cloud size={16} className="text-primary-400" />
        <h2 className="text-sm font-semibold text-slate-200">Sync across devices</h2>
      </div>

      {status !== 'signed-in' && (
        <div className="space-y-2">
          {configured ? (
            <>
              <p className="text-sm text-slate-400">
                Sign in to save your data and keep your phone and computer in sync.
              </p>
              <Button variant="primary" full onClick={() => void signIn()} disabled={status === 'signing-in'}>
                <span className="flex items-center justify-center gap-1.5">
                  <LogIn size={16} />
                  {status === 'signing-in' ? 'Signing in…' : 'Sign in with Google'}
                </span>
              </Button>

              <EmailPasswordSignIn />

              <p className="text-xs text-slate-500">
                Your data is private to your account. Everything keeps working without signing in — it
                just stays on this device.
              </p>
            </>
          ) : (
            <OwnProjectSetup connect={connect} />
          )}

          {/* The bring-your-own-Firebase path still exists, but it's an expert
              detour now that a project ships with the app — keep it out of the
              way so a new user only ever sees one button. */}
          {configured && (
            <>
              <button
                type="button"
                onClick={() => setAdvancedOpen((v) => !v)}
                className="flex w-full items-center justify-between pt-1 text-xs text-slate-500"
              >
                <span>Advanced: use my own Firebase project</span>
                {advancedOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {advancedOpen && (
                <div className="space-y-2 border-t border-slate-800 pt-2">
                  {usingOwnProject && (
                    <p className="text-xs text-emerald-400">This device is using your own Firebase project.</p>
                  )}
                  <OwnProjectSetup connect={connect} />
                  {usingOwnProject && (
                    <Button variant="ghost" full onClick={disconnect}>
                      Go back to the built-in project
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {status === 'signed-in' && user && (
        <div className="space-y-2">
          <p className="text-sm text-slate-200">{user.email ?? 'Signed in'}</p>
          <SyncStatusLine syncState={syncState} lastSyncedAt={lastSyncedAt} />
          <Button
            variant="ghost"
            full
            onClick={() => void refresh()}
            disabled={syncState === 'syncing'}
          >
            <span className="flex items-center justify-center gap-1.5">
              <RefreshCw size={16} className={syncState === 'syncing' ? 'animate-spin' : undefined} />
              {syncState === 'syncing' ? 'Pulling…' : 'Pull latest now'}
            </span>
          </Button>
          <AutoSyncSection uid={user.uid} />
          <Button variant="ghost" full onClick={() => void signOut()}>
            <span className="flex items-center justify-center gap-1.5">
              <LogOut size={16} />
              Sign out
            </span>
          </Button>
        </div>
      )}
    </Card>
  )
}

/** Friendlier text for the Firebase auth error codes people actually hit. */
function emailAuthError(err: unknown): string {
  const code = err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : ''
  if (code.includes('email-already-in-use')) return 'That email already has an account — try Sign in instead.'
  if (code.includes('invalid-email')) return "That doesn't look like a valid email."
  if (code.includes('weak-password')) return 'Password must be at least 6 characters.'
  if (code.includes('wrong-password') || code.includes('invalid-credential'))
    return 'Wrong email or password. Try again, or reset your password.'
  if (code.includes('user-not-found')) return 'No account with that email — try Create account.'
  if (code.includes('too-many-requests')) return 'Too many attempts — wait a moment and try again.'
  if (code.includes('operation-not-allowed'))
    return 'Email sign-in isn’t enabled yet on the server. (Enable Email/Password in Firebase.)'
  return 'Could not sign in. Check your details and try again.'
}

/**
 * Email + password sign-in — the auth path that works inside an installed iPhone
 * home-screen app, where Google's popup/redirect (and email links, which open in
 * Safari) can't complete. Collapsed behind a disclosure so the one-tap Google
 * button stays the headline for everyone else.
 */
function EmailPasswordSignIn() {
  const { emailSignIn, resetPassword, status } = useAuth()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const busy = status === 'signing-in'
  const canSubmit = /.+@.+\..+/.test(email) && password.length >= 6 && !busy

  async function submit() {
    setError('')
    setNotice('')
    try {
      await emailSignIn(mode, email, password)
      // On success the whole section re-renders as signed-in; nothing more to do.
    } catch (err) {
      setError(emailAuthError(err))
    }
  }

  async function forgotPassword() {
    setError('')
    setNotice('')
    if (!/.+@.+\..+/.test(email)) {
      setError('Enter your email above first, then tap reset.')
      return
    }
    try {
      await resetPassword(email)
      setNotice('Password reset email sent — check your inbox.')
    } catch (err) {
      setError(emailAuthError(err))
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-xs text-slate-400"
      >
        <span className="flex items-center gap-1.5">
          <Mail size={13} />
          Or use email &amp; password (works on iPhone home-screen app)
        </span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div className="mt-2 space-y-2 border-t border-slate-800 pt-2">
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => setMode('signin')}
              className={`rounded-lg py-1.5 text-xs font-medium ${mode === 'signin' ? 'bg-primary-500 text-slate-950' : 'bg-slate-800 text-slate-300'}`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setMode('signup')}
              className={`rounded-lg py-1.5 text-xs font-medium ${mode === 'signup' ? 'bg-primary-500 text-slate-950' : 'bg-slate-800 text-slate-300'}`}
            >
              Create account
            </button>
          </div>

          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-lg bg-slate-800 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-primary-500"
          />
          <input
            type="password"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (6+ characters)"
            className="w-full rounded-lg bg-slate-800 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-primary-500"
          />

          {error && <p className="text-sm text-red-400">{error}</p>}
          {notice && <p className="text-sm text-emerald-400">{notice}</p>}

          <Button variant="primary" full onClick={submit} disabled={!canSubmit}>
            {busy ? 'Working…' : mode === 'signup' ? 'Create account' : 'Sign in'}
          </Button>

          {mode === 'signin' && (
            <button
              type="button"
              onClick={forgotPassword}
              className="w-full text-center text-xs text-slate-500 active:text-slate-300"
            >
              Forgot password?
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/** The bring-your-own-Firebase flow: paste a config snippet to point this device
 * at a different project. Only reachable from the Advanced disclosure once a
 * project ships with the app; it's the whole sign-in screen when none does. */
function OwnProjectSetup({ connect }: { connect: (pasted: string) => boolean }) {
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [helpOpen, setHelpOpen] = useState(false)

  function handleConnect() {
    setError('')
    if (!connect(draft)) {
      setError("That doesn't look like a Firebase config")
      return
    }
    setDraft('')
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-400">
        Connect a free Firebase project to sync your nutrition, workouts, and body data across devices
        with Google sign-in.
      </p>

      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={'Paste your firebaseConfig here, e.g.\nconst firebaseConfig = { apiKey: "...", authDomain: "...", ... };'}
        rows={5}
        className="w-full bg-slate-800 rounded-lg px-3 py-2.5 text-xs font-mono text-slate-100 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-primary-500"
      />

      {error && <p className="text-sm text-red-400">{error}</p>}

      <Button variant="primary" full onClick={handleConnect} disabled={!draft.trim()}>
        Connect Firebase
      </Button>

      <button
        type="button"
        onClick={() => setHelpOpen((v) => !v)}
        className="flex w-full items-center justify-between text-sm text-slate-400"
      >
        <span>How to set this up</span>
        {helpOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {helpOpen && (
        <div className="space-y-3 text-xs text-slate-400">
          <ol className="list-decimal list-inside space-y-1.5">
            <li>
              Go to the{' '}
              <a
                href="https://console.firebase.google.com/"
                target="_blank"
                rel="noreferrer"
                className="text-primary-400 underline"
              >
                Firebase console
              </a>{' '}
              and click <span className="text-slate-300">Add project</span> (the free Spark plan is enough).
            </li>
            <li>
              In <span className="text-slate-300">Build → Authentication</span>, enable the{' '}
              <span className="text-slate-300">Google</span> sign-in provider.
            </li>
            <li>
              Still in Authentication, under <span className="text-slate-300">Settings → Authorized domains</span>,
              add <code className="rounded bg-slate-800 px-1 py-0.5">{AUTH_DOMAIN_HINT}</code>.
            </li>
            <li>
              In <span className="text-slate-300">Build → Firestore Database</span>, click{' '}
              <span className="text-slate-300">Create database</span>, then open the{' '}
              <span className="text-slate-300">Rules</span> tab and replace the contents with:
            </li>
          </ol>
          <pre className="overflow-x-auto rounded-lg bg-slate-800 p-2 text-[11px] text-slate-300">
            {FIRESTORE_RULES}
          </pre>
          <ol className="list-decimal list-inside space-y-1.5" start={5}>
            <li>
              In <span className="text-slate-300">Project settings → General</span>, scroll to{' '}
              <span className="text-slate-300">Your apps</span>, add a web app, and copy the{' '}
              <code className="rounded bg-slate-800 px-1 py-0.5">firebaseConfig</code> snippet it shows you.
            </li>
            <li>Paste it above and tap Connect Firebase.</li>
          </ol>
          <p>
            These config values aren't secret — they identify your project, not authorize access.
            Access is controlled by the Firestore rules above.
          </p>
        </div>
      )}
    </div>
  )
}

/** Surfaces the account UID and instructions for the Garmin auto-sync script
 * (scripts/garmin-sync.py --firebase), which writes wearable data straight to this
 * account so every device updates itself with no manual import. */
function AutoSyncSection({ uid }: { uid: string }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  function copyUid() {
    void navigator.clipboard?.writeText(uid).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div className="rounded-lg border border-slate-800 p-2.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-sm text-slate-300"
      >
        <span>Automate Garmin import</span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="mt-2.5 space-y-2.5 text-xs text-slate-400">
          <p>
            Run <code className="rounded bg-slate-800 px-1 py-0.5">scripts/garmin-sync.py --firebase</code>{' '}
            on your computer to pull your Garmin data straight into this account on a schedule — no
            file, no manual import. Every device updates automatically.
          </p>

          <div>
            <p className="mb-1 text-slate-500">Your account id (the script needs this):</p>
            <div className="flex items-center gap-1.5">
              <code className="flex-1 overflow-x-auto rounded bg-slate-800 px-2 py-1.5 text-[11px] text-slate-200">
                {uid}
              </code>
              <button
                type="button"
                onClick={copyUid}
                aria-label="Copy account id"
                className="shrink-0 rounded bg-slate-800 p-1.5 text-slate-300 active:bg-slate-700"
              >
                {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              </button>
            </div>
          </div>

          <ol className="list-decimal space-y-1.5 pl-4">
            <li>
              In the{' '}
              <a
                href="https://console.firebase.google.com/"
                target="_blank"
                rel="noreferrer"
                className="text-primary-400 underline"
              >
                Firebase console
              </a>
              , open <span className="text-slate-300">Project settings → Service accounts</span> and
              click <span className="text-slate-300">Generate new private key</span> — save the file
              as <code className="rounded bg-slate-800 px-1 py-0.5">serviceAccount.json</code>.
            </li>
            <li>
              Install the tools:{' '}
              <code className="rounded bg-slate-800 px-1 py-0.5">pip install garminconnect firebase-admin</code>
            </li>
            <li>Run it (copy your id from above):</li>
          </ol>

          <pre className="overflow-x-auto rounded-lg bg-slate-800 p-2 text-[11px] leading-relaxed text-slate-300">
            {`python3 scripts/garmin-sync.py --days 90 \\
  --firebase \\
  --service-account serviceAccount.json \\
  --uid ${uid}`}
          </pre>

          <p>
            To run it nightly, schedule that command with Task Scheduler (Windows) or cron
            (Mac/Linux). Your service-account key and Garmin credentials never leave your computer.
          </p>
        </div>
      )}
    </div>
  )
}

function SyncStatusLine({
  syncState,
  lastSyncedAt,
}: {
  syncState: 'idle' | 'syncing' | 'synced' | 'error'
  lastSyncedAt: number | null
}) {
  if (syncState === 'synced') {
    return (
      <p className="text-sm text-emerald-400">
        Synced ✓{lastSyncedAt ? <span className="text-slate-500"> · updated {relativeTime(lastSyncedAt)}</span> : null}
      </p>
    )
  }
  if (syncState === 'syncing') {
    return <p className="text-sm text-slate-400">Syncing…</p>
  }
  if (syncState === 'error') {
    return <p className="text-sm text-red-400">Sync error — check your connection and try Pull latest now</p>
  }
  return null
}

/** Compact "just now / 5m ago / 2h ago" label for the last cloud pull. */
function relativeTime(ts: number): string {
  const secs = Math.max(0, Math.round((Date.now() - ts) / 1000))
  if (secs < 10) return 'just now'
  if (secs < 60) return `${secs}s ago`
  const mins = Math.round(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

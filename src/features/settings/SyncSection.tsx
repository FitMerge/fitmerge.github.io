import { useState } from 'react'
import { Check, ChevronDown, ChevronUp, Cloud, Copy, LogIn, LogOut } from 'lucide-react'
import Card from '../../components/Card'
import Button from '../../components/Button'
import { useAuth } from '../../auth/AuthProvider'

const FIRESTORE_RULES = `match /users/{uid}/{doc=**} {
  allow read, write: if request.auth != null && request.auth.uid == uid;
}`

export default function SyncSection() {
  const { user, status, syncState, configured, signIn, signOut, connect, disconnect } = useAuth()
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [helpOpen, setHelpOpen] = useState(false)

  function handleConnect() {
    setError('')
    const ok = connect(draft)
    if (!ok) {
      setError("That doesn't look like a Firebase config")
      return
    }
    setDraft('')
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-2">
        <Cloud size={16} className="text-primary-400" />
        <h2 className="text-sm font-semibold text-slate-200">Sync across devices</h2>
      </div>

      {!configured && (
        <>
          <p className="text-sm text-slate-400">
            Connect a free Firebase project to sync your nutrition, workouts, and body data across
            devices with Google sign-in. Optional — everything keeps working locally without it.
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
                  add <code className="rounded bg-slate-800 px-1 py-0.5">skidude3892.github.io</code>.
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
        </>
      )}

      {configured && status !== 'signed-in' && (
        <div className="space-y-2">
          <p className="text-sm text-slate-400">Sign in with Google to start syncing this device.</p>
          <Button variant="primary" full onClick={() => void signIn()} disabled={status === 'signing-in'}>
            <span className="flex items-center justify-center gap-1.5">
              <LogIn size={16} />
              {status === 'signing-in' ? 'Signing in…' : 'Sign in with Google'}
            </span>
          </Button>
          <Button variant="ghost" full onClick={disconnect}>
            Disconnect Firebase
          </Button>
        </div>
      )}

      {status === 'signed-in' && user && (
        <div className="space-y-2">
          <p className="text-sm text-slate-200">{user.email ?? 'Signed in'}</p>
          <SyncStatusLine syncState={syncState} />
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

function SyncStatusLine({ syncState }: { syncState: 'idle' | 'syncing' | 'synced' | 'error' }) {
  if (syncState === 'synced') {
    return <p className="text-sm text-emerald-400">Synced ✓</p>
  }
  if (syncState === 'syncing') {
    return <p className="text-sm text-slate-400">Syncing…</p>
  }
  if (syncState === 'error') {
    return <p className="text-sm text-red-400">Sync error — check your setup</p>
  }
  return null
}

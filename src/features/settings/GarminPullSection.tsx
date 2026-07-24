import { useState } from 'react'
import { CheckCircle2, ChevronDown, ChevronUp, ExternalLink, Loader2, RefreshCw, XCircle } from 'lucide-react'
import Card from '../../components/Card'
import Button from '../../components/Button'
import { useSettingsStore } from '../../store/settings'
import { useGarminPull } from './useGarminPull'

function timeAgo(ts: number): string {
  const s = Math.round((Date.now() - ts) / 1000)
  if (s < 60) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h ago`
  return `${Math.round(h / 24)} d ago`
}

export default function GarminPullSection() {
  const token = useSettingsStore((s) => s.githubToken)
  const repo = useSettingsStore((s) => s.githubRepo)
  const setToken = useSettingsStore((s) => s.setGithubToken)
  const setRepo = useSettingsStore((s) => s.setGithubRepo)

  const { configured, phase: status, message, run, lastPull, pull } = useGarminPull()

  const [tokenDraft, setTokenDraft] = useState(token)
  const [repoDraft, setRepoDraft] = useState(repo)
  const [editing, setEditing] = useState(!configured)
  const [helpOpen, setHelpOpen] = useState(false)

  function saveConfig() {
    setToken(tokenDraft.trim())
    setRepo(repoDraft.trim())
    setEditing(false)
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-2">
        <RefreshCw size={16} className="text-primary-400" />
        <h2 className="text-sm font-semibold text-slate-200">Pull from Garmin</h2>
      </div>
      <p className="text-sm text-slate-400">
        Fetch your latest Garmin data on demand — it runs in the cloud, so it works even with your computer off.
        Auto-runs hourly too.
      </p>

      {configured && !editing && (
        <>
          <Button variant="primary" full onClick={pull} disabled={status === 'dispatching' || status === 'running'}>
            <span className="flex items-center justify-center gap-1.5">
              {status === 'dispatching' || status === 'running' ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <RefreshCw size={16} />
              )}
              {status === 'dispatching' ? 'Starting…' : status === 'running' ? 'Pulling…' : 'Pull from Garmin now'}
            </span>
          </Button>

          {status === 'running' && (
            <p className="text-xs text-slate-400">
              {run ? `Run ${run.status.replace('_', ' ')}…` : 'Starting the cloud job…'} Your data will appear
              automatically when it finishes (usually 1–2 min).
            </p>
          )}
          {status === 'done' && (
            <p className="flex items-center gap-1.5 text-xs text-emerald-400">
              <CheckCircle2 size={14} /> {message}
            </p>
          )}
          {status === 'error' && (
            <p className="flex items-start gap-1.5 text-xs text-rose-400">
              <XCircle size={14} className="mt-0.5 shrink-0" /> {message}
            </p>
          )}

          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{lastPull ? `Last pull ${timeAgo(lastPull)}` : 'Not pulled yet'}</span>
            <div className="flex items-center gap-3">
              {run?.url && (
                <a href={run.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary-400">
                  Run log <ExternalLink size={12} />
                </a>
              )}
              <button type="button" onClick={() => setEditing(true)} className="text-slate-400 underline">
                Settings
              </button>
            </div>
          </div>
        </>
      )}

      {editing && (
        <div className="space-y-2">
          <label className="block text-xs text-slate-400">GitHub repository (owner/repo)</label>
          <input
            value={repoDraft}
            onChange={(e) => setRepoDraft(e.target.value)}
            placeholder="yourname/your-repo"
            autoCapitalize="none"
            autoCorrect="off"
            className="w-full rounded-lg bg-slate-800 px-3 py-2.5 text-base text-slate-100 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-primary-500"
          />
          <label className="block text-xs text-slate-400">GitHub token (fine-grained, Actions: read & write)</label>
          <input
            type="password"
            value={tokenDraft}
            onChange={(e) => setTokenDraft(e.target.value)}
            placeholder="github_pat_…"
            autoCapitalize="none"
            autoCorrect="off"
            className="w-full rounded-lg bg-slate-800 px-3 py-2.5 text-base text-slate-100 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-primary-500"
          />
          <p className="text-[11px] text-slate-500">
            Saved privately to your own account, so it works on all your devices. Nobody else can see it.
          </p>
          <div className="flex gap-2">
            <Button variant="primary" full onClick={saveConfig} disabled={!tokenDraft.trim() || !repoDraft.trim()}>
              Save
            </Button>
            {configured && (
              <Button variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setHelpOpen((v) => !v)}
        className="flex w-full items-center justify-between text-sm text-slate-400"
      >
        <span>One-time setup</span>
        {helpOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {helpOpen && (
        <ol className="list-decimal space-y-2 pl-4 text-xs text-slate-400">
          <li>
            Log in to Garmin once on your computer:{' '}
            <code className="rounded bg-slate-800 px-1 py-0.5">python scripts/garmin-sync.py --days 7</code>, then export
            the saved session: <code className="rounded bg-slate-800 px-1 py-0.5">python scripts/garmin-sync.py --export-tokens</code>.
          </li>
          <li>
            In your GitHub repo → Settings → Secrets and variables → Actions, add secrets:{' '}
            <code className="rounded bg-slate-800 px-1 py-0.5">GARMIN_TOKENS_B64</code> (the exported line),{' '}
            <code className="rounded bg-slate-800 px-1 py-0.5">FIREBASE_SERVICE_ACCOUNT</code> (your key file’s
            contents), and <code className="rounded bg-slate-800 px-1 py-0.5">FIREBASE_UID</code> (Settings → Sync).
          </li>
          <li>Make sure the workflow file <code className="rounded bg-slate-800 px-1 py-0.5">garmin-pull.yml</code> is on your repo’s default branch.</li>
          <li>
            Create a fine-grained personal access token (GitHub → Settings → Developer settings) scoped to this repo
            with <span className="text-slate-300">Actions: Read and write</span>, and paste it above with your repo.
          </li>
        </ol>
      )}
    </Card>
  )
}

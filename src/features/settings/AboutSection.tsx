import { useState } from 'react'
import { ChevronDown, ChevronUp, Loader2, RefreshCw } from 'lucide-react'
import Card from '../../components/Card'
import Button from '../../components/Button'
import { checkForUpdate, forceReload } from '../../lib/appUpdate'
import { recentErrors } from '../../components/ErrorBoundary'

export default function AboutSection() {
  const [status, setStatus] = useState<'idle' | 'checking' | 'current'>('idle')
  const [changesOpen, setChangesOpen] = useState(false)

  async function onCheck() {
    setStatus('checking')
    try {
      const updated = await checkForUpdate()
      // If updated, the page reloads; otherwise show "up to date".
      if (!updated) setStatus('current')
    } catch {
      setStatus('current')
    }
  }

  return (
    <Card className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-slate-200 mb-1">About</h2>
        <p className="text-sm text-slate-300">FitMerge</p>
        <p className="text-xs text-slate-500">
          Version {__APP_VERSION__} · {__GIT_SHA__}
        </p>
        <p className="text-xs text-slate-500">Built {__BUILD_TIME__}</p>
        <p className="text-xs text-slate-500 mt-2">
          Nutrition tracking, workout logging, and progress charts — all in one lightweight app.
        </p>
      </div>

      {/* Recent changes come from git history at build time, so this list can
          never drift out of step with what is actually deployed. */}
      <div className="border-t border-slate-800 pt-2">
        <button
          type="button"
          onClick={() => setChangesOpen((v) => !v)}
          className="flex w-full items-center justify-between text-sm text-slate-400"
        >
          <span>What&apos;s new</span>
          {changesOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {changesOpen && (
          <div className="mt-2">
            {__CHANGELOG__.length === 0 ? (
              <p className="text-xs text-slate-500">No history available in this build.</p>
            ) : (
              <ul className="space-y-2.5">
                {__CHANGELOG__.map((entry) => (
                  <li key={entry.sha}>
                    <p className="text-xs text-slate-300">{entry.subject}</p>
                    <p className="text-[11px] text-slate-500">
                      {entry.date} · {entry.sha}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <Button variant="ghost" full onClick={onCheck} disabled={status === 'checking'}>
        <span className="flex items-center justify-center gap-1.5">
          {status === 'checking' ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
          {status === 'checking' ? 'Checking…' : 'Check for updates'}
        </span>
      </Button>
      {status === 'current' && (
        <div className="space-y-2 text-center">
          <p className="text-xs text-emerald-400">
            You&apos;re on version {__APP_VERSION__} ({__GIT_SHA__}), built {__BUILD_TIME__}.
          </p>
          <button
            type="button"
            onClick={forceReload}
            className="text-xs font-medium text-slate-400 underline underline-offset-2 active:text-slate-200"
          >
            Still looks old? Force a clean reload
          </button>
        </div>
      )}

      <ErrorLog />
    </Card>
  )
}

/**
 * Anything that went wrong this session. There's no crash reporting service, so
 * this is the only way a problem on someone's phone becomes reportable — without
 * it a failure is invisible to everyone including the person hitting it.
 */
function ErrorLog() {
  const errors = recentErrors()
  if (errors.length === 0) return null

  const report = `FitMerge ${__APP_VERSION__} (${__GIT_SHA__})\n${navigator.userAgent}\n\n${errors.join('\n')}`

  return (
    <details className="rounded-xl bg-slate-800/60 p-3">
      <summary className="cursor-pointer text-xs text-amber-300">
        {errors.length} problem{errors.length === 1 ? '' : 's'} this session
      </summary>
      <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words text-[11px] leading-relaxed text-slate-400">
        {errors.join('\n')}
      </pre>
      <button
        type="button"
        onClick={() => void navigator.clipboard?.writeText(report)}
        className="mt-2 text-[11px] text-primary-400 underline"
      >
        Copy for a bug report
      </button>
    </details>
  )
}

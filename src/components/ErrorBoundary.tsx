import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

type Props = { children: ReactNode }
type State = { error: Error | null; info: string }

/** Kept out of state so a render crash can't lose what was already recorded. */
const recent: string[] = []

/** The last few errors seen this session, newest first — surfaced in Settings →
 * About so a problem can be reported with something more useful than "it broke". */
export function recentErrors(): string[] {
  return [...recent].reverse()
}

export function recordError(error: unknown, source: string): void {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
  const stamp = new Date().toISOString().slice(11, 19)
  recent.push(`[${stamp}] ${source} — ${message}`)
  // Bounded: this is a breadcrumb trail, not a log store.
  if (recent.length > 10) recent.shift()
}

/**
 * Catches render crashes so a bug shows a recoverable screen instead of silently
 * white-screening the PWA — which, with no monitoring wired up, was previously
 * indistinguishable from the app failing to load at all.
 *
 * Deliberately not a full reload: reloading would discard the very state that
 * triggered the crash. "Try again" re-mounts the tree, which recovers from a
 * transient render error, and the details are copyable for a bug report.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: '' }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    recordError(error, 'render')
    // Still log: the console is the only place a developer on a desktop sees this.
    console.error('[fitmerge] render error', error, info.componentStack)
    this.setState({ info: (info.componentStack ?? '').split('\n').slice(0, 6).join('\n') })
  }

  render() {
    const { error, info } = this.state
    if (!error) return this.props.children

    const detail = `${error.name}: ${error.message}\n${info}`.trim()

    return (
      <div className="safe-screen flex min-h-dvh items-center justify-center bg-slate-950 p-4">
        <div className="w-full max-w-md space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-400">
              <AlertTriangle size={20} />
            </span>
            <div>
              <h1 className="text-base font-bold text-slate-100">Something broke on this screen</h1>
              <p className="text-xs text-slate-400">Your logged data is safe — it&apos;s stored on your device.</p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => this.setState({ error: null, info: '' })}
              className="flex-1 rounded-xl bg-primary-500 py-2.5 text-sm font-semibold text-slate-950 active:bg-primary-400"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="flex-1 rounded-xl bg-slate-800 py-2.5 text-sm font-medium text-slate-200 active:bg-slate-700"
            >
              Reload app
            </button>
          </div>

          <details className="rounded-xl bg-slate-950/60 p-3">
            <summary className="cursor-pointer text-xs text-slate-400">What went wrong</summary>
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words text-[11px] leading-relaxed text-slate-400">
              {detail}
            </pre>
            <button
              type="button"
              onClick={() => void navigator.clipboard?.writeText(detail)}
              className="mt-2 text-[11px] text-primary-400 underline"
            >
              Copy details
            </button>
          </details>
        </div>
      </div>
    )
  }
}

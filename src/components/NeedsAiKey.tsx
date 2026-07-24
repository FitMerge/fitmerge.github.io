import { Link } from 'react-router-dom'
import { Sparkles } from 'lucide-react'

/**
 * Shown wherever an AI feature is switched off because the user hasn't added a
 * (free) Google AI key yet. Deliberately reads as an invitation rather than an
 * error — this is the one setup step a non-technical user has to do, so it
 * points at the guided flow in Settings instead of naming an "API key".
 */
export default function NeedsAiKey({ what = 'This feature' }: { what?: string }) {
  return (
    <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-center">
      <Sparkles size={22} className="mx-auto text-primary-400" />
      <p className="text-sm text-slate-300">{what} needs Google's free AI switched on.</p>
      <p className="text-xs text-slate-500">It's free and takes about a minute to set up.</p>
      <Link
        to="/settings"
        className="inline-block rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-medium text-white active:bg-primary-600"
      >
        Set it up
      </Link>
    </div>
  )
}

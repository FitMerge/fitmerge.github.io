import { useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import Card from '../../components/Card'
import Button from '../../components/Button'
import { checkForUpdate, forceReload } from '../../lib/appUpdate'

export default function AboutSection() {
  const [status, setStatus] = useState<'idle' | 'checking' | 'current'>('idle')

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
        <p className="text-sm text-slate-300">Rung</p>
        <p className="text-xs text-slate-500">Version 0.1.0 · Build {__BUILD_TIME__}</p>
        <p className="text-xs text-slate-500 mt-2">
          Training, food and recovery — finally in one place.
        </p>
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
            You&apos;re on build {__BUILD_TIME__}.
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
    </Card>
  )
}

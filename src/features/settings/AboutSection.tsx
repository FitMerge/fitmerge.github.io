import { useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import Card from '../../components/Card'
import Button from '../../components/Button'
import { checkForUpdate } from '../../lib/appUpdate'

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
        <p className="text-sm text-slate-300">FitMerge</p>
        <p className="text-xs text-slate-500">Version 0.1.0 · Build {__BUILD_TIME__}</p>
        <p className="text-xs text-slate-500 mt-2">
          Nutrition tracking, workout logging, and progress charts — all in one lightweight app.
        </p>
      </div>

      <Button variant="ghost" full onClick={onCheck} disabled={status === 'checking'}>
        <span className="flex items-center justify-center gap-1.5">
          {status === 'checking' ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
          {status === 'checking' ? 'Checking…' : 'Check for updates'}
        </span>
      </Button>
      {status === 'current' && (
        <p className="text-center text-xs text-emerald-400">You&apos;re on the latest version.</p>
      )}
    </Card>
  )
}

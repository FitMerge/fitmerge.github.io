import { Volume2, VolumeX } from 'lucide-react'

type RestTimerBarProps = {
  secondsLeft: number
  totalSeconds: number
  soundOn: boolean
  onToggleSound: () => void
  onAddTime: () => void
  onSkip: () => void
}

export default function RestTimerBar({
  secondsLeft,
  totalSeconds,
  soundOn,
  onToggleSound,
  onAddTime,
  onSkip,
}: RestTimerBarProps) {
  const pct = totalSeconds > 0 ? Math.min(1, Math.max(0, 1 - secondsLeft / totalSeconds)) : 0
  const done = secondsLeft <= 0
  const mm = String(Math.floor(Math.max(0, secondsLeft) / 60)).padStart(2, '0')
  const ss = String(Math.max(0, secondsLeft) % 60).padStart(2, '0')

  return (
    <div className="sticky bottom-0 inset-x-0 -mx-4 mt-4 px-4 pt-3 pb-4 bg-slate-900 border-t border-slate-800 shadow-[0_-8px_16px_rgba(0,0,0,0.35)]">
      <div className="h-1 w-full rounded-full bg-slate-800 overflow-hidden mb-3">
        <div
          className={`h-full transition-all ${done ? 'bg-emerald-400' : 'bg-primary-500'}`}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-slate-400">{done ? 'Rest complete' : 'Rest'}</p>
          <p className={`text-xl font-bold tabular-nums ${done ? 'text-emerald-300' : 'text-slate-100'}`}>
            {mm}:{ss}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleSound}
            aria-label={soundOn ? 'Mute rest timer sound' : 'Unmute rest timer sound'}
            aria-pressed={soundOn}
            className={`rounded-lg px-2.5 py-2 ${soundOn ? 'bg-slate-800 text-primary-300' : 'bg-slate-800 text-slate-500'}`}
          >
            {soundOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
          <button
            type="button"
            onClick={onAddTime}
            className="rounded-lg bg-slate-800 active:bg-slate-700 px-3 py-2 text-xs font-medium text-slate-200"
          >
            +15s
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="rounded-lg bg-primary-500 active:bg-primary-600 px-3 py-2 text-xs font-semibold text-slate-950"
          >
            {done ? 'Done' : 'Skip'}
          </button>
        </div>
      </div>
    </div>
  )
}

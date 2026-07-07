type RestTimerBarProps = {
  secondsLeft: number
  totalSeconds: number
  onAddTime: () => void
  onSkip: () => void
}

export default function RestTimerBar({ secondsLeft, totalSeconds, onAddTime, onSkip }: RestTimerBarProps) {
  const pct = totalSeconds > 0 ? Math.min(1, Math.max(0, 1 - secondsLeft / totalSeconds)) : 0
  const mm = String(Math.floor(Math.max(0, secondsLeft) / 60)).padStart(2, '0')
  const ss = String(Math.max(0, secondsLeft) % 60).padStart(2, '0')

  return (
    <div className="sticky bottom-0 inset-x-0 -mx-4 mt-4 px-4 pt-3 pb-4 bg-slate-900 border-t border-slate-800 shadow-[0_-8px_16px_rgba(0,0,0,0.35)]">
      <div className="h-1 w-full rounded-full bg-slate-800 overflow-hidden mb-3">
        <div className="h-full bg-primary-500 transition-all" style={{ width: `${pct * 100}%` }} />
      </div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-slate-400">Rest</p>
          <p className="text-xl font-bold text-slate-100 tabular-nums">
            {mm}:{ss}
          </p>
        </div>
        <div className="flex items-center gap-2">
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
            Skip
          </button>
        </div>
      </div>
    </div>
  )
}

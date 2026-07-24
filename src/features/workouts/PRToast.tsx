import { useEffect, useRef, useState } from 'react'
import { Check, Trophy } from 'lucide-react'
import { prLabel, type PRHit } from './prDetect'
import { weightUnitLabel } from './utils'
import type { Units } from '../../types'

export type PRCelebration = { id: number; exerciseName: string; hits: PRHit[] }

const HEADLINES = ['New PR! 🎉', 'Personal best! 💪', "Let's go! 🔥", 'New record! 🏆']
const VISIBLE_MS = 5000

function hitText(hit: PRHit, units: Units): string {
  const unit = weightUnitLabel(units)
  return `${prLabel(hit.kind)} · ${hit.value.toLocaleString()} ${unit}`
}

/** Transient celebratory banner shown when a completed set sets a personal record.
 * Slides in from the top, auto-dismisses after ~5s, or tap the check to dismiss now. */
export default function PRToast({
  celebration,
  units,
  onDone,
}: {
  celebration: PRCelebration | null
  units: Units
  onDone: () => void
}) {
  const [shown, setShown] = useState(false)
  // Keep the latest onDone without making it a timer dependency — the parent
  // re-renders every second (workout clock), which would otherwise restart the
  // dismiss timer forever and the banner would never leave.
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  const id = celebration?.id
  useEffect(() => {
    if (id === undefined) return
    setShown(true)
    const hideT = setTimeout(() => setShown(false), VISIBLE_MS)
    const doneT = setTimeout(() => onDoneRef.current(), VISIBLE_MS + 300)
    return () => {
      clearTimeout(hideT)
      clearTimeout(doneT)
    }
  }, [id])

  if (!celebration) return null

  const headline = HEADLINES[celebration.id % HEADLINES.length]

  function dismiss() {
    setShown(false)
    setTimeout(() => onDoneRef.current(), 200)
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-3">
      <div
        className={`flex w-full max-w-md items-center gap-3 rounded-2xl border border-amber-400/40 bg-gradient-to-br from-amber-500/25 to-slate-900 px-4 py-3 shadow-xl shadow-amber-500/10 transition-all duration-300 ${
          shown ? 'translate-y-0 opacity-100' : '-translate-y-6 opacity-0'
        }`}
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-400/20">
          <Trophy size={20} className="text-amber-300" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-amber-200">{headline}</p>
          <p className="truncate text-xs text-slate-200">{celebration.exerciseName}</p>
          <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
            {celebration.hits.map((h) => (
              <span key={h.kind} className="text-[11px] text-amber-100/90">
                {hitText(h, units)}
              </span>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="pointer-events-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-400/20 text-amber-200 active:bg-amber-400/30"
        >
          <Check size={16} strokeWidth={3} />
        </button>
      </div>
    </div>
  )
}

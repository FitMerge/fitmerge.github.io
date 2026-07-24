import { useEffect, useState } from 'react'
import { Trophy } from 'lucide-react'
import { prLabel, type PRHit } from './prDetect'
import { weightUnitLabel } from './utils'
import type { Units } from '../../types'

export type PRCelebration = { id: number; exerciseName: string; hits: PRHit[] }

const HEADLINES = ['New PR! 🎉', 'Personal best! 💪', "Let's go! 🔥", 'New record! 🏆']

function hitText(hit: PRHit, units: Units): string {
  const unit = weightUnitLabel(units)
  if (hit.kind === 'weight') return `${prLabel(hit.kind)} · ${hit.value} ${unit}`
  if (hit.kind === '1rm') return `${prLabel(hit.kind)} · ${hit.value} ${unit}`
  return `${prLabel(hit.kind)} · ${hit.value.toLocaleString()} ${unit}`
}

/** Transient celebratory banner shown when a completed set sets a personal record.
 * Slides in from the top, then auto-dismisses. */
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

  useEffect(() => {
    if (!celebration) return
    setShown(true)
    const showT = setTimeout(() => setShown(false), 3200)
    const doneT = setTimeout(onDone, 3500)
    return () => {
      clearTimeout(showT)
      clearTimeout(doneT)
    }
  }, [celebration, onDone])

  if (!celebration) return null

  // A stable headline per celebration id so it doesn't flicker between renders.
  const headline = HEADLINES[celebration.id % HEADLINES.length]

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-3">
      <div
        className={`w-full max-w-md rounded-2xl border border-amber-400/40 bg-gradient-to-br from-amber-500/25 to-slate-900 px-4 py-3 shadow-xl shadow-amber-500/10 transition-all duration-300 ${
          shown ? 'translate-y-0 opacity-100' : '-translate-y-6 opacity-0'
        }`}
      >
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-400/20">
            <Trophy size={20} className="text-amber-300" />
          </span>
          <div className="min-w-0">
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
        </div>
      </div>
    </div>
  )
}

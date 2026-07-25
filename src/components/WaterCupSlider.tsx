import { useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { Minus, Plus } from 'lucide-react'
import { WATER_UNITS, type WaterUnit } from '../lib/units'

type WaterCupSliderProps = {
  /** Current amount, in canonical ml. */
  valueMl: number
  /** The day's goal, in ml — drawn as a line across the cup. */
  goalMl: number
  /** Top of the slider range, in ml — a full cup. */
  maxMl: number
  unit: WaterUnit
  onChange: (ml: number) => void
}

// Cup interior spans these y-coordinates within the 120×170 viewBox; the water
// surface and the drag math both work off this band so they stay in lock-step.
const TOP_Y = 18
const BOTTOM_Y = 152
const INNER_H = BOTTOM_Y - TOP_Y
const VIEW_H = 170

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/**
 * A glass you fill by dragging up or down: the water level follows your finger and
 * the amount reads out live, in whichever unit is selected. Same feel as the weight
 * ruler, but vertical and literal — you're filling a cup. Snaps to the unit's step,
 * shows the daily goal as a line, and is keyboard-driftable with the arrow keys.
 */
export default function WaterCupSlider({ valueMl, goalMl, maxMl, unit, onChange }: WaterCupSliderProps) {
  const u = WATER_UNITS[unit]
  const surfaceRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const fill = maxMl > 0 ? clamp(valueMl / maxMl, 0, 1) : 0
  const waterY = BOTTOM_Y - fill * INNER_H
  const goalFrac = maxMl > 0 ? clamp(goalMl / maxMl, 0, 1) : 0
  const goalY = BOTTOM_Y - goalFrac * INNER_H

  const display = u.fromMl(valueMl)
  const goalDisplay = u.fromMl(goalMl)
  const maxDisplay = u.fromMl(maxMl)
  const reached = valueMl >= goalMl - 1

  // Snap an ml amount onto the current unit's step and keep it in range.
  const snapMl = (ml: number) => {
    const stepped = Math.round(u.fromMl(ml) / u.step) * u.step
    return clamp(u.toMl(stepped), 0, maxMl)
  }

  const setFromClientY = (clientY: number) => {
    const el = surfaceRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    // The interior band occupies TOP_Y..BOTTOM_Y of the viewBox; map the pointer
    // into that band so the top of the water tracks the top of the glass.
    const topPx = rect.top + (rect.height * TOP_Y) / VIEW_H
    const botPx = rect.top + (rect.height * BOTTOM_Y) / VIEW_H
    const f = clamp((botPx - clientY) / (botPx - topPx), 0, 1)
    onChange(snapMl(f * maxMl))
  }

  const onPointerDown = (e: ReactPointerEvent) => {
    dragging.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    setFromClientY(e.clientY)
  }
  const onPointerMove = (e: ReactPointerEvent) => {
    if (!dragging.current) return
    setFromClientY(e.clientY)
  }
  const onPointerUp = (e: ReactPointerEvent) => {
    dragging.current = false
    e.currentTarget.releasePointerCapture(e.pointerId)
  }

  const nudge = (dir: 1 | -1) => {
    const next = clamp(Math.round((display + dir * u.step) / u.step) * u.step, 0, maxDisplay)
    onChange(u.toMl(next))
  }

  return (
    <div className="flex flex-col items-center">
      <div className="mb-2 text-center">
        <span className="text-5xl font-bold tabular-nums text-sky-300">{display.toFixed(u.decimals)}</span>
        <span className="ml-1.5 text-xl font-medium text-slate-400">{u.label}</span>
        <p className="mt-0.5 text-xs text-slate-500">
          {reached ? (
            <span className="text-emerald-400">Goal reached 🎉</span>
          ) : (
            <>
              of {goalDisplay.toFixed(u.decimals)} {u.label} goal
            </>
          )}
        </p>
      </div>

      <div className="flex items-stretch gap-3">
        <button
          type="button"
          onClick={() => nudge(-1)}
          aria-label={`Remove ${u.step} ${u.label}`}
          className="self-center rounded-lg bg-slate-800 p-2 text-slate-300 active:bg-slate-700"
        >
          <Minus size={18} />
        </button>

        {/* The glass itself is the slider: drag anywhere on it, up or down. */}
        <div
          ref={surfaceRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          role="slider"
          tabIndex={0}
          aria-label="Water amount"
          aria-valuemin={0}
          aria-valuemax={Number(maxDisplay.toFixed(u.decimals))}
          aria-valuenow={Number(display.toFixed(u.decimals))}
          aria-valuetext={`${display.toFixed(u.decimals)} ${u.label}`}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
              e.preventDefault()
              nudge(1)
            } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
              e.preventDefault()
              nudge(-1)
            }
          }}
          className="h-56 w-40 cursor-ns-resize touch-none select-none outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded-xl"
        >
          <svg viewBox="0 0 120 170" className="h-full w-full">
            <defs>
              <clipPath id="cup-interior">
                <path d="M26 18 L94 18 L82 152 L38 152 Z" />
              </clipPath>
              <linearGradient id="water-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#0284c7" />
              </linearGradient>
            </defs>

            {/* Water — clipped to the glass interior, animating its height. */}
            <g clipPath="url(#cup-interior)">
              <rect x="18" y={waterY} width="84" height={VIEW_H} fill="url(#water-fill)" className="transition-[y] duration-150 ease-out" />
              {/* Surface highlight so the top of the water reads as a meniscus. */}
              <ellipse cx="60" cy={waterY} rx="40" ry="3.5" fill="#7dd3fc" opacity={fill > 0.02 ? 0.9 : 0} className="transition-[cy] duration-150 ease-out" />
            </g>

            {/* Goal marker. */}
            <line x1="24" y1={goalY} x2="96" y2={goalY} stroke="#64748b" strokeWidth="1.5" strokeDasharray="4 3" />
            <text x="99" y={goalY + 3.5} fill="#94a3b8" fontSize="9">
              goal
            </text>

            {/* Glass outline, drawn last so it sits above the water. */}
            <path
              d="M24 14 L96 14 L83 156 Q83 160 79 160 L41 160 Q37 160 37 156 Z"
              fill="none"
              stroke="#cbd5e1"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <button
          type="button"
          onClick={() => nudge(1)}
          aria-label={`Add ${u.step} ${u.label}`}
          className="self-center rounded-lg bg-slate-800 p-2 text-slate-300 active:bg-slate-700"
        >
          <Plus size={18} />
        </button>
      </div>

      <p className="mt-2 text-[11px] text-slate-500">Drag the glass up or down</p>
    </div>
  )
}

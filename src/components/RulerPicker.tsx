import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Minus, Plus } from 'lucide-react'

type RulerPickerProps = {
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  /** Smallest increment; 0.1 gives one-decimal precision. */
  step?: number
  unit?: string
  className?: string
}

// Pixels between minor ticks. Wide enough that a 0.1 step is an easy, deliberate drag.
const PX = 12

/**
 * A horizontal "wheel" ruler you drag left/right to dial a number, iOS-Health style.
 * The centre needle marks the current value; tick marks and whole-number labels
 * scroll under it. Decimal precision comes from the step (0.1). Native horizontal
 * scrolling gives real touch momentum; ticks are virtualised so only the ~visible
 * few dozen render regardless of range.
 */
export default function RulerPicker({ value, onChange, min, max, step = 0.1, unit, className }: RulerPickerProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)

  const decimals = step < 1 ? 1 : 0
  const count = Math.max(1, Math.round((max - min) / step)) // last tick index
  const snap = (v: number) => Number((Math.round(v / step) * step).toFixed(decimals))
  const idxOf = (v: number) => Math.round((v - min) / step)

  const valueRef = useRef(value)
  valueRef.current = value
  const settingRef = useRef(false) // true while we set scrollLeft programmatically
  const snapTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // Mouse grab-drag. Touch uses native overflow scrolling (free momentum); mouse
  // doesn't scroll a container by dragging, so we drive scrollLeft ourselves.
  const drag = useRef<{ startX: number; startScroll: number } | null>(null)

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const measure = () => setWidth(el.clientWidth)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Keep the scroll position in sync when `value` changes from outside (initial
  // value, +/- buttons). Guard so this doesn't echo back through onChange.
  useEffect(() => {
    const el = scrollRef.current
    if (!el || !width) return
    const target = idxOf(value) * PX
    if (Math.abs(el.scrollLeft - target) > 1) {
      settingRef.current = true
      el.scrollLeft = target
      setScrollLeft(target)
      requestAnimationFrame(() => {
        settingRef.current = false
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, width])

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setScrollLeft(el.scrollLeft)
    if (settingRef.current) return
    const k = Math.min(count, Math.max(0, Math.round(el.scrollLeft / PX)))
    const v = snap(min + k * step)
    if (Math.abs(v - valueRef.current) >= step / 2) onChange(v)
    // Settle onto the nearest tick once scrolling stops.
    if (snapTimer.current) clearTimeout(snapTimer.current)
    snapTimer.current = setTimeout(() => {
      const kk = Math.min(count, Math.max(0, Math.round(el.scrollLeft / PX)))
      el.scrollTo({ left: kk * PX, behavior: 'smooth' })
    }, 140)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, min, step])

  const nudge = (dir: 1 | -1) => onChange(snap(Math.min(max, Math.max(min, value + dir * step))))

  const half = width / 2
  const first = Math.max(0, Math.floor((scrollLeft - half) / PX) - 2)
  const last = Math.min(count, Math.ceil((scrollLeft + half) / PX) + 2)
  const ticks: number[] = []
  for (let i = first; i <= last; i++) ticks.push(i)
  const contentWidth = count * PX + width

  return (
    <div className={className}>
      <div className="mb-1 text-center">
        <span className="text-4xl font-bold tabular-nums text-slate-100">{value.toFixed(decimals)}</span>
        {unit && <span className="ml-1.5 text-lg font-medium text-slate-400">{unit}</span>}
      </div>

      <div className="relative flex items-center gap-2">
        <button
          type="button"
          onClick={() => nudge(-1)}
          aria-label="Decrease"
          className="shrink-0 rounded-lg bg-slate-800 p-2 text-slate-300 active:bg-slate-700"
        >
          <Minus size={16} />
        </button>

        {/* Clip taller inner scroller so its scrollbar hides below the fold. */}
        <div className="relative flex-1 overflow-hidden" style={{ height: 64 }}>
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            onPointerDown={(e) => {
              if (e.pointerType === 'touch') return // native scroll handles touch
              const el = scrollRef.current
              if (!el) return
              drag.current = { startX: e.clientX, startScroll: el.scrollLeft }
              el.setPointerCapture(e.pointerId)
            }}
            onPointerMove={(e) => {
              const el = scrollRef.current
              if (!drag.current || !el) return
              el.scrollLeft = drag.current.startScroll - (e.clientX - drag.current.startX)
            }}
            onPointerUp={(e) => {
              if (!drag.current) return
              drag.current = null
              scrollRef.current?.releasePointerCapture(e.pointerId)
            }}
            className="h-[84px] cursor-grab overflow-x-scroll overflow-y-hidden active:cursor-grabbing"
            style={{ scrollbarWidth: 'none' }}
            role="slider"
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={value}
            aria-label="Value ruler"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
                e.preventDefault()
                nudge(1)
              } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
                e.preventDefault()
                nudge(-1)
              }
            }}
          >
            <div className="relative" style={{ width: contentWidth, height: 64 }}>
              {ticks.map((i) => {
                const val = min + i * step
                const isMajor = Math.abs(val - Math.round(val)) < step / 2
                return (
                  <div
                    key={i}
                    className={isMajor ? 'absolute top-0 w-px bg-slate-500' : 'absolute top-0 w-px bg-slate-700'}
                    style={{ left: half + i * PX, height: isMajor ? 30 : 18 }}
                  >
                    {isMajor && (
                      <span className="absolute left-1/2 top-9 -translate-x-1/2 text-[11px] tabular-nums text-slate-500">
                        {Math.round(val)}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Fixed centre needle + edge fades. */}
          <div className="pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2">
            <div className="h-8 w-0.5 rounded-full bg-primary-400" />
          </div>
          <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-slate-900 to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-slate-900 to-transparent" />
        </div>

        <button
          type="button"
          onClick={() => nudge(1)}
          aria-label="Increase"
          className="shrink-0 rounded-lg bg-slate-800 p-2 text-slate-300 active:bg-slate-700"
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  )
}

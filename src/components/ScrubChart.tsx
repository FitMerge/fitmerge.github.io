// Charts you can actually read on a phone.
//
// Recharts' tooltip is built for a mouse. On touch, three separate things go
// wrong at once:
//
//   1. A tap shows nothing. Recharts' touchstart handler only forwards the event
//      to `onMouseDown` — it never sets the tooltip's own state. Only touchMOVE
//      activates it, so the value appears only while you drag.
//   2. Dragging scrolls the page. The chart is a block in a scrolling list, so
//      the browser claims the gesture and the chart slides away under the finger
//      you were reading with.
//   3. When the box does appear it floats over the plot — covering the very data
//      you pointed at, on the narrowest screen there is.
//
// So the readout moves OUT of the plot and sits above it, always populated, and
// the selection runs off pointer state we own:
//
//   • mousedown / touchstart → snap immediately. No throttle, no 300 ms click
//     delay, and it fixes (1) because recharts hands `onMouseDown` the same
//     `activeTooltipIndex` its tooltip would have used.
//   • mousemove / touchmove  → scrub.
//   • touch-action: pan-y    → fixes (2). Vertical swipes still scroll the page;
//     horizontal drags are ours and never scroll.
//
// Lifting a finger does NOT clear the selection — on a phone you read the number
// after you move your hand, not while it is covering the screen. A mouse leaving
// the chart does clear it, because there the pointer is the cursor.

import { cloneElement, useCallback, useState, type ReactElement } from 'react'
import { ResponsiveContainer } from 'recharts'

/** The slice of recharts' chart state we use. */
type ChartMouseState = {
  activeTooltipIndex?: number
  activeCoordinate?: { x: number; y: number }
}

export type ReadoutItem = {
  key: string
  /** Series name — omit for a single-series chart, where it is just noise. */
  name?: string
  value: string
  /** Matches the series colour, so the eye pairs number to line. */
  color?: string
}

type Props<T> = {
  data: T[]
  height: number
  /** The x-axis value of a point, spelled out — "Jul 12", not "7/12". */
  label: (point: T) => string
  /** What to read out. Return [] for a point with no reading. */
  values: (point: T) => ReadoutItem[]
  /** Shown when `values` is empty — "no reading", "rest day", … */
  empty?: string
  /** Which point to read out before the user touches anything. Defaults to the
   * last, which is wrong for a series that ends in a forecast. */
  defaultIndex?: number
  /** The recharts chart. Its own <Tooltip> should be removed; this replaces it. */
  children: ReactElement
}

export default function ScrubChart<T>({
  data,
  height,
  label,
  values,
  empty = 'no reading',
  defaultIndex,
  children,
}: Props<T>) {
  const [picked, setPicked] = useState<{ index: number; x: number } | null>(null)

  const pick = useCallback(
    (state: ChartMouseState | null) => {
      const i = state?.activeTooltipIndex
      if (typeof i !== 'number' || i < 0) return
      setPicked({ index: i, x: state?.activeCoordinate?.x ?? 0 })
    },
    [],
  )
  const clear = useCallback(() => setPicked(null), [])

  // Nothing selected → read out the newest point. A chart that shows a number
  // before you touch it is worth more than one that waits to be asked.
  const fallback = defaultIndex != null && defaultIndex < data.length ? defaultIndex : data.length - 1
  const index = picked && picked.index < data.length ? picked.index : fallback
  const point = data[index]
  const items = point ? values(point) : []

  const chart = cloneElement(children as ReactElement<Record<string, unknown>>, {
    onMouseDown: pick,
    onMouseMove: pick,
    onClick: pick,
    onMouseLeave: clear,
  })

  return (
    <div className="space-y-1.5">
      <div className="flex min-h-[26px] items-center justify-between gap-2 rounded-lg bg-slate-800/60 px-2.5 py-1">
        <span className="shrink-0 text-[11px] text-slate-400">
          {point ? label(point) : '—'}
          {!picked && <span className="text-slate-600"> · latest</span>}
        </span>
        <div className="flex min-w-0 flex-wrap justify-end gap-x-3 gap-y-0.5">
          {items.length === 0 ? (
            <span className="text-[11px] text-slate-500">{empty}</span>
          ) : (
            items.map((it) => (
              <span key={it.key} className="text-[11px] tabular-nums">
                {it.name && (
                  <span className="text-slate-500" style={it.color ? { color: it.color } : undefined}>
                    {it.name}{' '}
                  </span>
                )}
                <span className="font-semibold text-slate-100">{it.value}</span>
              </span>
            ))
          )}
        </div>
      </div>

      {/* pan-y: the browser keeps vertical scrolling, we keep horizontal drags. */}
      <div className="relative" style={{ height, touchAction: 'pan-y' }}>
        <ResponsiveContainer width="100%" height="100%">
          {chart}
        </ResponsiveContainer>
        {picked && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 w-px bg-slate-400/70"
            style={{ left: picked.x }}
          />
        )}
      </div>
    </div>
  )
}

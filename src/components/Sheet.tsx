import { useCallback, useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { X } from 'lucide-react'

type SheetProps = {
  open: boolean
  onClose: () => void
  title?: string
  children?: ReactNode
}

const ENTER_MS = 260
const EXIT_MS = 220

/**
 * Bottom sheet with a native-feeling slide-up + backdrop fade, a drag handle you
 * can flick down to dismiss, and a scroll area that won't chain-scroll the page
 * behind it. The component stays mounted through its exit animation so closing
 * doesn't hard-pop. Body scroll is locked while open.
 */
export default function Sheet({ open, onClose, title, children }: SheetProps) {
  // `mounted` keeps the node in the DOM across the exit animation; `shown` drives
  // the transform/opacity so the enter transition runs after the first paint.
  const [mounted, setMounted] = useState(open)
  const [shown, setShown] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ startY: number; dy: number; dragging: boolean }>({ startY: 0, dy: 0, dragging: false })

  useEffect(() => {
    if (open) {
      setMounted(true)
      // Next frame: flip to shown so the CSS transition animates from off-screen.
      const id = requestAnimationFrame(() => setShown(true))
      return () => cancelAnimationFrame(id)
    }
    setShown(false)
    const t = setTimeout(() => setMounted(false), EXIT_MS)
    return () => clearTimeout(t)
  }, [open])

  // Lock body scroll while the sheet is on screen.
  useEffect(() => {
    if (!mounted) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [mounted])

  // Close on Escape (desktop / external keyboards).
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const setTranslate = useCallback((y: number) => {
    const el = panelRef.current
    if (el) el.style.transform = `translateY(${y}px)`
  }, [])

  function onPointerDown(e: PointerEvent) {
    drag.current = { startY: e.clientY, dy: 0, dragging: true }
    const el = panelRef.current
    if (el) el.style.transition = 'none'
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }

  function onPointerMove(e: PointerEvent) {
    if (!drag.current.dragging) return
    const dy = Math.max(0, e.clientY - drag.current.startY) // only downward
    drag.current.dy = dy
    setTranslate(dy)
  }

  function onPointerUp() {
    if (!drag.current.dragging) return
    const { dy } = drag.current
    drag.current.dragging = false
    const el = panelRef.current
    if (el) el.style.transition = ''
    // Flicked far enough → dismiss; otherwise spring back to rest.
    if (dy > 110) {
      onClose()
    } else {
      setTranslate(0)
    }
  }

  if (!mounted) return null

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/60 transition-opacity duration-200"
        style={{ opacity: shown ? 1 : 0 }}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className="absolute bottom-0 left-0 right-0 mx-auto flex max-h-[88dvh] max-w-md flex-col rounded-t-2xl border-t border-slate-800 bg-slate-900 shadow-2xl shadow-black/40"
        style={{
          transform: shown ? 'translateY(0)' : 'translateY(100%)',
          transition: `transform ${shown ? ENTER_MS : EXIT_MS}ms cubic-bezier(0.32, 0.72, 0, 1)`,
        }}
      >
        {/* Drag handle — grab anywhere in this header region to flick the sheet away. */}
        <div
          className="shrink-0 cursor-grab touch-none pt-2.5 active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className="mx-auto h-1.5 w-10 rounded-full bg-slate-700" />
          <div className="flex items-center justify-between px-4 pb-3 pt-3">
            <h2 className="text-lg font-bold">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-slate-800 p-1.5 active:bg-slate-700"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable content — overscroll-contain stops the page behind from moving. */}
        <div className="safe-bottom min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
          {children}
        </div>
      </div>
    </div>
  )
}

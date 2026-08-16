import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

/**
 * A titled header bar that expands to reveal its content below. Lets a data-rich
 * screen show the full menu of what's available at a glance while keeping each
 * detailed block one tap away — nothing buried, nothing a wall. The content
 * (often already-carded sections) renders as siblings below the bar rather than
 * nested inside it, so there's no double-card look, and only mounts while open so
 * heavy/lazy children don't load until expanded.
 */
export default function Collapsible({
  title,
  subtitle,
  defaultOpen = false,
  children,
}: {
  title: string
  subtitle?: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-left active:bg-slate-800/40"
        aria-expanded={open}
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-slate-200">{title}</span>
          {subtitle && <span className="block truncate text-xs text-slate-500">{subtitle}</span>}
        </span>
        <ChevronDown size={18} className={`shrink-0 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && children}
    </div>
  )
}

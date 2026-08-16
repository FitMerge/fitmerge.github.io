import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

/**
 * One card whose header taps to open. The title, the chevron and the content all
 * live inside a single border, so it reads unambiguously as one card that is open
 * or shut — earlier this was a separate header pill sitting above a separate
 * content card, which left it unclear whether the bar belonged to what was above
 * or below it. The content (sections rendered in their `bare` mode, without their
 * own card or header) only mounts while open, so heavy/lazy children don't load
 * until expanded.
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
    <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left active:bg-slate-800/40"
        aria-expanded={open}
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-slate-200">{title}</span>
          {subtitle && <span className="block truncate text-xs text-slate-500">{subtitle}</span>}
        </span>
        <ChevronDown size={18} className={`shrink-0 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="border-t border-slate-800 p-4">{children}</div>}
    </div>
  )
}

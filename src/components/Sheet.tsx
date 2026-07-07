import type { ReactNode } from 'react'
import { X } from 'lucide-react'

type SheetProps = {
  open: boolean
  onClose: () => void
  title?: string
  children?: ReactNode
}

export default function Sheet({ open, onClose, title, children }: SheetProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="absolute bottom-0 left-0 right-0 max-w-md mx-auto rounded-t-2xl bg-slate-900 border-t border-slate-800 max-h-[85dvh] overflow-y-auto p-4 safe-bottom">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 bg-slate-800 active:bg-slate-700"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

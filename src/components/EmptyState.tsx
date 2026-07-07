import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

type EmptyStateProps = {
  icon: LucideIcon
  title: string
  subtitle?: string
  action?: ReactNode
}

export default function EmptyState({ icon: Icon, title, subtitle, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center text-center py-12 px-4">
      <div className="rounded-full bg-slate-900 p-4 ring-1 ring-slate-800">
        <Icon size={28} className="text-slate-500" />
      </div>
      <h3 className="mt-4 font-semibold text-slate-200">{title}</h3>
      {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

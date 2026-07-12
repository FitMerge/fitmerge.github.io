import { Check, Plus } from 'lucide-react'
import Card from '../../components/Card'

type SearchResultRowProps = {
  name: string
  brand?: string
  subtitle: string
  calorieLabel: string
  onClick: () => void
  /** When provided, a one-tap "+" logs this food instantly (MyFitnessPal-style). */
  onQuickAdd?: () => void
  /** Show a check instead of a plus (e.g. just added). */
  added?: boolean
}

export default function SearchResultRow({
  name,
  brand,
  subtitle,
  calorieLabel,
  onClick,
  onQuickAdd,
  added,
}: SearchResultRowProps) {
  return (
    <Card className="p-3 flex items-center gap-3 active:bg-slate-800/60" onClick={onClick}>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-100">{name}</p>
        <p className="truncate text-xs text-slate-500">
          {brand ? `${brand} · ` : ''}
          {subtitle}
        </p>
      </div>
      <span className="shrink-0 text-xs text-slate-400 text-right">{calorieLabel}</span>
      {onQuickAdd && (
        <button
          type="button"
          aria-label={added ? `${name} added` : `Quick add ${name}`}
          onClick={(e) => {
            e.stopPropagation()
            onQuickAdd()
          }}
          className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${
            added
              ? 'bg-emerald-500 text-slate-950'
              : 'bg-emerald-500/10 text-emerald-400 active:bg-emerald-500/20'
          }`}
        >
          {added ? <Check size={16} strokeWidth={3} /> : <Plus size={18} />}
        </button>
      )}
    </Card>
  )
}

import Card from '../../components/Card'

type SearchResultRowProps = {
  name: string
  brand?: string
  subtitle: string
  calorieLabel: string
  onClick: () => void
}

export default function SearchResultRow({ name, brand, subtitle, calorieLabel, onClick }: SearchResultRowProps) {
  return (
    <Card className="p-3 flex items-center gap-3 active:bg-slate-800/60" onClick={onClick}>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-100">{name}</p>
        <p className="truncate text-xs text-slate-500">
          {brand ? `${brand} · ` : ''}
          {subtitle}
        </p>
      </div>
      <span className="shrink-0 text-xs text-slate-400">{calorieLabel}</span>
    </Card>
  )
}

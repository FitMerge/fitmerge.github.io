export type SegmentedOption<T extends string> = { key: T; label: string }

type SegmentedControlProps<T extends string> = {
  options: readonly SegmentedOption<T>[]
  value: T
  onChange: (key: T) => void
  /** `md` = top-level view tabs (iOS-style track); `sm` = per-chart range pills. */
  size?: 'sm' | 'md'
  className?: string
  ariaLabel?: string
}

/**
 * One segmented control for the whole app — replaces the five hand-rolled range-pill
 * rows that each had their own markup and option set. Used both for the top-level
 * domain tabs (Body/Nutrition/Training, Today/Vitals/Fitness) at `md`, and for the
 * per-chart time-range selectors at `sm`.
 */
export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  className = '',
  ariaLabel,
}: SegmentedControlProps<T>) {
  if (size === 'sm') {
    return (
      <div role="tablist" aria-label={ariaLabel} className={`flex gap-1.5 ${className}`}>
        {options.map((opt) => {
          const active = opt.key === value
          return (
            <button
              key={opt.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(opt.key)}
              className={`flex-1 rounded-full py-1 text-xs font-medium transition-colors ${
                active ? 'bg-primary-500 font-semibold text-slate-950' : 'bg-slate-800 text-slate-400 active:bg-slate-700'
              }`}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`flex gap-1 rounded-xl bg-slate-800/70 p-1 ${className}`}
    >
      {options.map((opt) => {
        const active = opt.key === value
        return (
          <button
            key={opt.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.key)}
            className={`flex-1 rounded-lg py-1.5 text-sm font-medium transition-colors ${
              active ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 active:text-slate-200'
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

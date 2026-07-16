type CompactStepperProps = {
  label: string
  value: number
  onChange: (value: number) => void
  step?: number
  min?: number
  suffix?: string
}

/** A narrower stepper than NumberField, sized to fit three-across in a grid-cols-3 row. */
export default function CompactStepper({ label, value, onChange, step = 1, min = 0, suffix }: CompactStepperProps) {
  const clamp = (n: number) => Math.max(min, n)

  return (
    <div>
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onChange(clamp(value - step))}
          aria-label={`Decrease ${label}`}
          className="w-9 h-9 shrink-0 rounded-lg bg-slate-800 active:bg-slate-700 flex items-center justify-center text-base"
        >
          -
        </button>
        <span className="flex-1 min-w-0 text-center text-sm text-slate-100 tabular-nums">
          {value}
          {suffix && <span className="text-slate-500">{suffix}</span>}
        </span>
        <button
          type="button"
          onClick={() => onChange(clamp(value + step))}
          aria-label={`Increase ${label}`}
          className="w-9 h-9 shrink-0 rounded-lg bg-slate-800 active:bg-slate-700 flex items-center justify-center text-base"
        >
          +
        </button>
      </div>
    </div>
  )
}

type NumberFieldProps = {
  label: string
  value: number
  onChange: (value: number) => void
  step?: number
  min?: number
  suffix?: string
}

export default function NumberField({
  label,
  value,
  onChange,
  step = 1,
  min = 0,
  suffix,
}: NumberFieldProps) {
  const clamp = (n: number) => Math.max(min, n)

  return (
    <div>
      <label className="block text-sm text-slate-400 mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(clamp(value - step))}
          className="rounded-lg bg-slate-800 active:bg-slate-700 w-10 h-10 flex items-center justify-center text-lg"
          aria-label={`Decrease ${label}`}
        >
          -
        </button>
        <div className="relative flex-1">
          <input
            type="number"
            inputMode="decimal"
            value={value}
            min={min}
            step={step}
            onChange={(e) => onChange(clamp(Number(e.target.value)))}
            className="bg-slate-800 rounded-lg text-center w-full py-2"
          />
          {suffix && (
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">
              {suffix}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => onChange(clamp(value + step))}
          className="rounded-lg bg-slate-800 active:bg-slate-700 w-10 h-10 flex items-center justify-center text-lg"
          aria-label={`Increase ${label}`}
        >
          +
        </button>
      </div>
    </div>
  )
}

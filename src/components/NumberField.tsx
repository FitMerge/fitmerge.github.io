import { useEffect, useRef, useState } from 'react'

type NumberFieldProps = {
  label: string
  value: number
  onChange: (value: number) => void
  step?: number
  min?: number
  suffix?: string
}

/** Renders a number as a clean string ("12", "12.5", "0") with no trailing ".0". */
function formatNum(value: number): string {
  if (!Number.isFinite(value)) return '0'
  return String(value)
}

/** Sanitizes raw input to digits + a single decimal point, with leading zeros
 * stripped ("05" → "5", "012.5" → "12.5") while keeping "0" and "0.5" intact. */
function sanitize(raw: string): string {
  let s = raw.replace(/[^\d.]/g, '')
  const dot = s.indexOf('.')
  if (dot !== -1) s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, '')
  s = s.replace(/^0+(?=\d)/, '')
  return s
}

export default function NumberField({ label, value, onChange, step = 1, min = 0, suffix }: NumberFieldProps) {
  const clamp = (n: number) => Math.max(min, n)

  // Local text draft so the field can be blank / mid-decimal while typing without
  // snapping back to "0" — the stored numeric value stays correct throughout.
  const [draft, setDraft] = useState<string>(() => formatNum(value))
  const focused = useRef(false)

  // Reflect external value changes (± buttons, unit toggle, reset) when not editing.
  useEffect(() => {
    if (!focused.current) setDraft(formatNum(value))
  }, [value])

  function setBoth(next: number) {
    const c = clamp(next)
    setDraft(formatNum(c))
    onChange(c)
  }

  function handleInput(raw: string) {
    const s = sanitize(raw)
    setDraft(s)
    if (s === '' || s === '.') {
      onChange(clamp(0))
      return
    }
    const n = Number(s)
    if (Number.isFinite(n)) onChange(clamp(n))
  }

  return (
    <div>
      <label className="block text-sm text-slate-400 mb-1">{label}</label>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setBoth(value - step)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-lg active:bg-slate-700"
          aria-label={`Decrease ${label}`}
        >
          -
        </button>
        {/* Input and suffix are flex siblings, so the unit takes its own space and
            the number can never run underneath it, however many digits it grows to. */}
        <div className="flex flex-1 items-center overflow-hidden rounded-lg bg-slate-800 focus-within:ring-2 focus-within:ring-primary-500">
          <input
            type="text"
            inputMode="decimal"
            value={draft}
            onChange={(e) => handleInput(e.target.value)}
            onFocus={(e) => {
              focused.current = true
              e.currentTarget.select()
            }}
            onBlur={() => {
              focused.current = false
              setDraft(formatNum(value))
            }}
            className="min-w-0 flex-1 bg-transparent py-2 text-center outline-none"
          />
          {suffix && <span className="shrink-0 pr-2.5 text-xs text-slate-500">{suffix}</span>}
        </div>
        <button
          type="button"
          onClick={() => setBoth(value + step)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-lg active:bg-slate-700"
          aria-label={`Increase ${label}`}
        >
          +
        </button>
      </div>
    </div>
  )
}

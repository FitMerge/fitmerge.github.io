import { useEffect, useRef, useState } from 'react'
import { Check, Trophy } from 'lucide-react'
import type { SetLog, SetType, Units } from '../../types'
import { weightUnitLabel } from './utils'

type SetRowProps = {
  index: number
  set: SetLog
  units: Units
  /** Matching set from the previous session, shown as a ghost reference. */
  previous?: SetLog
  /** True when this completed working set is a new est-1RM personal record. */
  isPR?: boolean
  onChange: (patch: Partial<SetLog>) => void
  onCheckedOn: () => void
}

// Warmup → drop → normal cycle when the set badge is tapped.
const NEXT_TYPE: Record<SetType, SetType> = { normal: 'warmup', warmup: 'drop', drop: 'normal' }

function typeStyle(type: SetType | undefined): { label: string; cls: string } {
  switch (type) {
    case 'warmup':
      return { label: 'W', cls: 'bg-amber-500/20 text-amber-400' }
    case 'drop':
      return { label: 'D', cls: 'bg-purple-500/20 text-purple-400' }
    default:
      return { label: '', cls: 'bg-slate-800 text-slate-400' }
  }
}

/** Compact numeric field for the set table — tap-to-clear, no steppers. */
function CompactNumber({
  value,
  onChange,
  ariaLabel,
  done,
}: {
  value: number
  onChange: (v: number) => void
  ariaLabel: string
  done: boolean
}) {
  const [draft, setDraft] = useState(() => String(value))
  const focused = useRef(false)
  useEffect(() => {
    if (!focused.current) setDraft(String(value))
  }, [value])

  return (
    <input
      type="text"
      inputMode="decimal"
      aria-label={ariaLabel}
      value={draft}
      onChange={(e) => {
        let s = e.target.value.replace(/[^\d.]/g, '')
        const dot = s.indexOf('.')
        if (dot !== -1) s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, '')
        s = s.replace(/^0+(?=\d)/, '')
        setDraft(s)
        onChange(s === '' || s === '.' ? 0 : Number(s))
      }}
      onFocus={(e) => {
        focused.current = true
        e.currentTarget.select()
      }}
      onBlur={() => {
        focused.current = false
        setDraft(String(value))
      }}
      className={`w-full rounded-lg py-2 text-center text-sm font-semibold tabular-nums outline-none focus:ring-2 focus:ring-primary-500 ${
        done ? 'bg-emerald-500/10 text-emerald-300' : 'bg-slate-800 text-slate-100'
      }`}
    />
  )
}

export default function SetRow({ index, set, units, previous, isPR, onChange, onCheckedOn }: SetRowProps) {
  function toggleDone() {
    const next = !set.done
    onChange({ done: next })
    if (next) onCheckedOn()
  }

  function cycleType() {
    onChange({ type: NEXT_TYPE[set.type ?? 'normal'] })
  }

  const ts = typeStyle(set.type)
  const prevText = previous ? `${previous.weight}×${previous.reps}` : '—'

  return (
    <div className="grid grid-cols-[2rem_1fr_1fr_1fr_2.25rem] items-center gap-1.5 py-1.5">
      <button
        type="button"
        onClick={cycleType}
        aria-label={`Set ${index + 1} type`}
        className={`h-8 rounded-lg text-xs font-bold ${ts.cls}`}
      >
        {ts.label || index + 1}
      </button>

      <button
        type="button"
        onClick={() => previous && onChange({ weight: previous.weight, reps: previous.reps })}
        disabled={!previous}
        aria-label="Copy previous set"
        className="truncate text-center text-xs tabular-nums text-slate-500 disabled:opacity-60"
      >
        {prevText}
      </button>

      <CompactNumber
        value={set.weight}
        onChange={(v) => onChange({ weight: v })}
        ariaLabel={`Set ${index + 1} weight in ${weightUnitLabel(units)}`}
        done={set.done}
      />
      <CompactNumber
        value={set.reps}
        onChange={(v) => onChange({ reps: v })}
        ariaLabel={`Set ${index + 1} reps`}
        done={set.done}
      />

      <div className="flex items-center justify-end gap-0.5">
        {isPR && set.done && <Trophy size={13} className="text-amber-400" aria-label="Personal record" />}
        <button
          type="button"
          onClick={toggleDone}
          aria-label={set.done ? `Set ${index + 1} done` : `Mark set ${index + 1} done`}
          className={`flex h-8 w-8 items-center justify-center rounded-lg border ${
            set.done
              ? 'border-primary-500 bg-primary-500 text-slate-950'
              : 'border-slate-700 bg-transparent text-slate-600'
          }`}
        >
          <Check size={16} strokeWidth={3} />
        </button>
      </div>
    </div>
  )
}

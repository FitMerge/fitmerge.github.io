import { RANGE_OPTIONS, type RangeKey } from './utils'

type RangeSelectorProps = {
  value: RangeKey
  onChange: (range: RangeKey) => void
}

export default function RangeSelector({ value, onChange }: RangeSelectorProps) {
  return (
    <div className="flex gap-2">
      {RANGE_OPTIONS.map((opt) => (
        <button
          key={opt.key}
          type="button"
          onClick={() => onChange(opt.key)}
          className={`flex-1 rounded-full py-1.5 text-sm font-medium ${
            value === opt.key ? 'bg-primary-500 text-slate-950 font-semibold' : 'bg-slate-800 text-slate-300'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

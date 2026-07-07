import { macroPct } from '../lib/macros'

type MacroBarProps = {
  label: string
  value: number
  goal: number
  color: string
  unit?: string
}

export default function MacroBar({ label, value, goal, color, unit = 'g' }: MacroBarProps) {
  const pct = macroPct(value, goal)

  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-slate-300">{label}</span>
        <span className="text-slate-400">
          {Math.round(value)}/{Math.round(goal)} {unit}
        </span>
      </div>
      <div className="mt-1 h-2 rounded-full bg-slate-800">
        <div
          className={`h-2 rounded-full ${color}`}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
    </div>
  )
}

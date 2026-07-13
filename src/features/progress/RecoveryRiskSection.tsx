import { useMemo } from 'react'
import { ShieldAlert } from 'lucide-react'
import Card from '../../components/Card'
import { useWorkoutsStore } from '../../store/workouts'
import { useHealthStore } from '../../store/health'
import { acwr, type AcwrLevel } from '../../lib/trainingLoad'
import { coachSignals } from '../../lib/coachSignals'

// ACWR gauge zones across a 0–2 scale (clamped). Colors mark the risk bands.
const LEVEL_COLOR: Record<AcwrLevel, string> = {
  low: '#38bdf8',
  optimal: '#34d399',
  high: '#fbbf24',
  danger: '#f87171',
}

const SIGNAL_CLASSES: Record<string, string> = {
  red: 'border-red-500/60 bg-red-500/10',
  amber: 'border-amber-500/50 bg-amber-500/10',
  green: 'border-emerald-500/50 bg-emerald-500/10',
}

export default function RecoveryRiskSection() {
  const sessions = useWorkoutsStore((s) => s.sessions)
  const days = useHealthStore((s) => s.days)

  const risk = useMemo(() => acwr(sessions), [sessions])
  const signals = useMemo(() => coachSignals(days), [days])

  if (!risk && signals.every((s) => s.title === 'Not enough data yet')) {
    return (
      <Card className="space-y-2">
        <Header />
        <p className="text-xs text-slate-500">
          Import a few weeks of Garmin workouts and health data to see your injury-risk gauge and
          recovery flags.
        </p>
      </Card>
    )
  }

  // Position the marker on a 0–2 ACWR scale (0.8–1.3 is the green sweet spot).
  const pct = risk ? Math.min(100, Math.max(0, (risk.ratio / 2) * 100)) : 0

  return (
    <Card className="space-y-3">
      <Header />

      {risk && (
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-slate-400">Acute:Chronic load ratio</span>
            <span className="text-lg font-bold" style={{ color: LEVEL_COLOR[risk.level] }}>
              {risk.ratio.toFixed(2)}
              <span className="ml-1.5 text-xs font-semibold">{risk.label}</span>
            </span>
          </div>

          {/* Zone bar: blue (detraining) | green (sweet spot) | amber | red. */}
          <div className="relative h-3 w-full overflow-hidden rounded-full">
            <div className="absolute inset-0 flex">
              <div className="h-full" style={{ width: '40%', background: '#38bdf833' }} />
              <div className="h-full" style={{ width: '25%', background: '#34d39955' }} />
              <div className="h-full" style={{ width: '10%', background: '#fbbf2455' }} />
              <div className="h-full" style={{ width: '25%', background: '#f8717155' }} />
            </div>
            <div
              className="absolute top-1/2 h-4 w-1 -translate-y-1/2 rounded-full bg-white shadow"
              style={{ left: `calc(${pct}% - 2px)` }}
            />
          </div>
          <p className="text-[11px] text-slate-400">{risk.detail}</p>
        </div>
      )}

      <div className="space-y-2 pt-1">
        {signals
          .filter((s) => s.title !== 'Not enough data yet')
          .map((sig, i) => (
            <div key={i} className={`rounded-lg border p-2.5 ${SIGNAL_CLASSES[sig.level]}`}>
              <p className="text-xs font-semibold text-slate-100">{sig.title}</p>
              <p className="text-[11px] text-slate-300">{sig.detail}</p>
            </div>
          ))}
      </div>
    </Card>
  )
}

function Header() {
  return (
    <div className="flex items-center gap-2">
      <ShieldAlert size={16} className="text-amber-400" />
      <h2 className="text-sm font-semibold text-slate-200">Injury &amp; illness risk</h2>
    </div>
  )
}

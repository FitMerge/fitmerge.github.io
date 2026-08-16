import { useMemo } from 'react'
import { ShieldAlert } from 'lucide-react'
import Card from '../../components/Card'
import { useWorkoutsStore } from '../../store/workouts'
import { useHealthStore } from '../../store/health'
import { acwr, hasRealTrainingLoad, type AcwrLevel } from '../../lib/trainingLoad'
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
  const calibrated = useMemo(() => hasRealTrainingLoad(sessions), [sessions])

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
  const flags = signals.filter((s) => s.title !== 'Not enough data yet')

  return (
    <Card className="space-y-3">
      <Header />

      <p className="text-[11px] leading-relaxed text-slate-400">
        A <span className="font-medium text-slate-300">leading indicator</span>, not a diagnosis: it flags
        when your training is ramping faster than your body has adapted to — the window most associated with
        injury and illness — plus recovery markers that tend to move first.
      </p>

      {risk && (
        <div className="space-y-2">
          {/* The actual load numbers, not just the ratio — so "acute load" reads as
              the hundreds it is on the watch, not a bare 1.x. */}
          <div className="grid grid-cols-3 gap-2">
            <LoadTile label="Acute" sub="last 7 days" value={Math.round(risk.acute).toLocaleString()} />
            <LoadTile label="Chronic" sub="weekly avg" value={Math.round(risk.chronic).toLocaleString()} />
            <LoadTile
              label="Ratio"
              sub={risk.label}
              value={risk.ratio.toFixed(2)}
              color={LEVEL_COLOR[risk.level]}
            />
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
          <div className="flex justify-between text-[9px] text-slate-500">
            <span>detraining</span>
            <span>sweet spot</span>
            <span>injury risk →</span>
          </div>

          <p className="text-[11px] text-slate-400">{risk.detail}</p>
          <p className="text-[10px] leading-relaxed text-slate-500">
            The ratio is your <span className="text-slate-400">acute</span> load (total of the last 7 days)
            divided by your <span className="text-slate-400">chronic</span> load (average week over the last
            28). Load is {calibrated ? "Garmin's own training-load number" : "estimated from each activity's calories"}.
          </p>
        </div>
      )}

      {flags.length > 0 && (
        <div className="space-y-2 border-t border-slate-800 pt-2.5">
          <p className="text-[11px] font-medium text-slate-400">
            Recovery signals{' '}
            <span className="font-normal text-slate-500">· from HRV, resting HR, sleep &amp; Body Battery</span>
          </p>
          {flags.map((sig, i) => (
            <div key={i} className={`rounded-lg border p-2.5 ${SIGNAL_CLASSES[sig.level]}`}>
              <p className="text-xs font-semibold text-slate-100">{sig.title}</p>
              <p className="text-[11px] text-slate-300">{sig.detail}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

function LoadTile({ label, sub, value, color }: { label: string; sub: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg bg-slate-800/60 p-2.5 text-center">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 text-lg font-bold tabular-nums" style={{ color: color ?? '#e2e8f0' }}>
        {value}
      </p>
      <p className="truncate text-[9px] text-slate-500">{sub}</p>
    </div>
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

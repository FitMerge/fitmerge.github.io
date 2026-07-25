// Race predictions and training paces — the analysis panel Garmin, Strava and
// MapMyRun all build their running experience around.
//
// Everything here derives from one performance: the best run in the selected
// window, judged by VDOT rather than by pace so a strong half beats a quick
// parkrun. Predictions carry a confidence, and the source of the estimate is
// named, because a marathon time extrapolated from a 5K is a guess and saying so
// is the difference between a useful number and a misleading one.

import { useMemo, useState } from 'react'
import { ChevronDown, Gauge } from 'lucide-react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import Card from '../../components/Card'
import { useWorkoutsStore } from '../../store/workouts'
import { useSettingsStore } from '../../store/settings'
import { distanceUnitLabel, formatDuration, formatPace, type CardioRange } from './cardio'
import { estimateFitness, vdotTrend, type Confidence } from './racePrediction'
import { monthDayLabel } from '../progress/utils'

const CONFIDENCE_STYLE: Record<Confidence, { dot: string; label: string }> = {
  high: { dot: 'bg-emerald-400', label: 'Close to a distance you have actually run' },
  moderate: { dot: 'bg-amber-400', label: 'Extrapolated — treat as a target, not a time' },
  low: { dot: 'bg-slate-500', label: 'A long way from your reference run; low confidence' },
}

export default function RacePredictionSection({ range }: { range: CardioRange }) {
  const sessions = useWorkoutsStore((s) => s.sessions)
  const units = useSettingsStore((s) => s.units)
  const distUnit = distanceUnitLabel(units)
  const [pacesOpen, setPacesOpen] = useState(false)

  const trend = useMemo(() => vdotTrend(sessions, range), [sessions, range])
  const garminRecords = useWorkoutsStore((s) => s.garminRecords)
  const estimate = useMemo(
    () => estimateFitness(sessions, units, range, undefined, garminRecords),
    [sessions, units, range, garminRecords],
  )

  if (estimate === null) {
    return (
      <Card className="space-y-2">
        <Header />
        <p className="text-xs text-slate-500">
          Log or import a run of at least 1.5 km with both a distance and a duration, and
          predicted race times and training paces will appear here.
        </p>
      </Card>
    )
  }

  const { source, predictions, paces } = estimate

  return (
    <Card className="space-y-3">
      <Header />

      {/* The estimate's provenance, stated up front. Every number below is only as
          good as this one run, and hiding that would be the dishonest choice. */}
      <div className="flex items-baseline justify-between gap-2 rounded-xl bg-slate-800/60 p-2.5">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">
            Based on {source.fromRecord ? 'your Garmin PR' : 'your best run'}
          </p>
          <p className="truncate text-xs text-slate-300">
            {formatDuration(source.durationMin)} over {source.km.toFixed(2)} km
            {source.date !== '' && ` · ${monthDayLabel(source.date)}`}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-lg font-bold leading-none text-primary-400 tabular-nums">
            {estimate.vdot.toFixed(1)}
          </p>
          <p className="text-[10px] text-slate-500">VDOT</p>
        </div>
      </div>

      <div className="space-y-1">
        {predictions.map((p) => {
          const style = CONFIDENCE_STYLE[p.confidence]
          return (
            <div
              key={p.label}
              className={`flex items-center gap-2 rounded-lg px-2.5 py-2 ${
                p.isSource ? 'bg-primary-500/10' : 'bg-slate-800/40'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${style.dot}`}
                title={style.label}
                aria-label={style.label}
              />
              <span className="w-16 shrink-0 text-xs font-medium text-slate-300">{p.label}</span>
              <span className="flex-1 text-right text-sm font-bold text-slate-100 tabular-nums">
                {formatDuration(p.durationMin)}
              </span>
              <span className="w-16 shrink-0 text-right text-[11px] text-slate-500 tabular-nums">
                {formatPace(p.pace)}/{distUnit}
              </span>
            </div>
          )
        })}
      </div>

      {/* Fitness over time — Garmin's race-predictor trend. One point per period,
          taken from the best run in it, because fitness is what you are capable of
          rather than what you did on an easy Tuesday. */}
      {trend.filter((t) => t.vdot !== null).length >= 3 && (
        <div className="space-y-1 border-t border-slate-800 pt-2.5">
          <p className="text-[11px] font-medium text-slate-400">Fitness trend</p>
          <div style={{ height: 120 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#1e293b" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#64748b', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={16}
                />
                <YAxis
                  tick={{ fill: '#64748b', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={34}
                  domain={['dataMin - 2', 'dataMax + 2']}
                  tickFormatter={(v: number) => v.toFixed(0)}
                />
                <Tooltip
                  cursor={{ stroke: '#334155' }}
                  contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#cbd5e1' }}
                  formatter={(v: number, _n, entry) => [
                    `VDOT ${v.toFixed(1)} · 5K ${formatDuration(
                      (entry?.payload as { predicted5k: number }).predicted5k,
                    )}`,
                    'Best',
                  ]}
                />
                {/* No connectNulls: a period with no hard running is a gap in the
                    evidence, not a straight line between two months of fitness. */}
                <Line
                  type="linear"
                  dataKey="vdot"
                  stroke="#38bdf8"
                  strokeWidth={2}
                  dot={{ r: 2.5, fill: '#38bdf8', strokeWidth: 0 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[10px] text-slate-500">
            Best VDOT per period. Rising means you are getting fitter; gaps are periods
            with no run long enough to judge.
          </p>
        </div>
      )}

      <p className="text-[10px] leading-relaxed text-slate-500">
        Riegel's model, the same one Garmin's race predictor uses. Green is close to a distance
        you have run; grey is a long extrapolation.
      </p>

      {/* Training paces are the part a runner uses weekly, but they are a wall of
          numbers next to five predictions — so they fold away by default. */}
      <button
        type="button"
        onClick={() => setPacesOpen((v) => !v)}
        className="flex w-full items-center justify-between border-t border-slate-800 pt-2.5 text-left"
        aria-expanded={pacesOpen}
      >
        <span className="text-[11px] font-medium text-slate-400">Training paces</span>
        <ChevronDown
          size={14}
          className={`text-slate-500 transition-transform ${pacesOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {pacesOpen && (
        <div className="space-y-1">
          {paces.map((p) => (
            <div key={p.key} className="flex items-center gap-2 rounded-lg bg-slate-800/40 px-2.5 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-slate-200">{p.label}</p>
                <p className="truncate text-[10px] text-slate-500">{p.description}</p>
              </div>
              <span className="shrink-0 text-xs font-semibold text-slate-100 tabular-nums">
                {formatPace(p.fastMin)}–{formatPace(p.slowMin)}
                <span className="ml-1 font-normal text-slate-500">/{distUnit}</span>
              </span>
            </div>
          ))}
          <p className="text-[10px] text-slate-500">
            Daniels' training intensities for VDOT {estimate.vdot.toFixed(1)}. Most weekly volume
            belongs in the easy band.
          </p>
        </div>
      )}
    </Card>
  )
}

function Header() {
  return (
    <div className="flex items-center gap-2">
      <Gauge size={16} className="text-primary-400" />
      <h2 className="text-sm font-semibold text-slate-200">Race predictions</h2>
    </div>
  )
}

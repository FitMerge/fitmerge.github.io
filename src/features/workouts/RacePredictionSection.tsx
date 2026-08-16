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
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import Card from '../../components/Card'
import ScrubChart from '../../components/ScrubChart'
import { useWorkoutsStore } from '../../store/workouts'
import { healthDaysDesc, useHealthStore } from '../../store/health'
import { useSettingsStore } from '../../store/settings'
import { distanceUnitLabel, formatDuration, formatPace, type CardioRange } from './cardio'
import {
  estimateFitness,
  garminFitness,
  garminVdotTrend,
  latestVo2max,
  vdotTrend,
  vo2maxTrend,
  type Confidence,
} from './racePrediction'
import { monthDayLabel } from '../progress/utils'

const CONFIDENCE_STYLE: Record<Confidence, { dot: string; label: string }> = {
  high: { dot: 'bg-emerald-400', label: 'Predicted from a effort at a similar distance' },
  moderate: { dot: 'bg-amber-400', label: 'Extrapolated — treat as a target, not a time' },
  low: { dot: 'bg-slate-500', label: 'A long way from your nearest effort; low confidence' },
}

/** "from your 10K, May 4" — what a given row actually rests on. */
function sourceNote(source: { km: number; date: string; name: string; fromRecord: boolean }): string {
  // A watch prediction is not a run you did, so it must not be described as one.
  if (source.name === 'Garmin') {
    return source.date ? `Garmin · ${monthDayLabel(source.date)}` : 'Garmin'
  }
  const distance = source.km >= 1 ? `${source.km.toFixed(source.km < 10 ? 1 : 0)} km` : `${Math.round(source.km * 1000)} m`
  const what = source.fromRecord ? `${distance} PR` : `${distance} run`
  return source.date ? `${what} · ${monthDayLabel(source.date)}` : what
}

export default function RacePredictionSection({
  range,
  bare = false,
}: {
  range: CardioRange
  /** Inside a Collapsible the card and title come from it, so drop ours. */
  bare?: boolean
}) {
  const sessions = useWorkoutsStore((s) => s.sessions)
  const units = useSettingsStore((s) => s.units)
  const distUnit = distanceUnitLabel(units)
  const [pacesOpen, setPacesOpen] = useState(false)

  const garminRecords = useWorkoutsStore((s) => s.garminRecords)
  const days = useHealthStore((s) => s.days)
  const desc = useMemo(() => healthDaysDesc(days), [days])

  // Garmin's own predictor wins when the watch has produced one: it is calibrated
  // against on-device heart rate and training load over a very large population,
  // where everything below is a two-parameter curve fit over one distance and one
  // duration per run. The computed estimate is the fallback for anyone without
  // that data — a friend on Apple Health, or a fresh account.
  const estimate = useMemo(
    () => garminFitness(desc, units) ?? estimateFitness(sessions, units, range, undefined, garminRecords),
    [desc, sessions, units, range, garminRecords],
  )
  const fromGarmin = estimate?.origin === 'garmin'

  // VO2 max leads because it is the term people already know and the one on the
  // watch. VDOT still powers every prediction and training pace below — it carries
  // running economy, which the pace tables need — but it is no longer surfaced as a
  // competing score: toggling it changed the badge and the trend line while the
  // predicted times, which are always VDOT-derived, stayed identical. That read as
  // two predictors giving the same answer. So we show VO2 max when the watch has
  // it, and fall back to VDOT only when it doesn't.
  const vo2 = useMemo(() => latestVo2max(desc), [desc])
  const showingVo2 = vo2 !== null

  const trend = useMemo(() => {
    if (showingVo2) return vo2maxTrend(desc, range)
    return fromGarmin ? garminVdotTrend(desc, range) : vdotTrend(sessions, range)
  }, [showingVo2, fromGarmin, desc, sessions, range])

  if (estimate === null) {
    const empty = (
      <p className="text-xs text-slate-500">
        Log or import a run of at least 1.5 km with both a distance and a duration, and
        predicted race times and training paces will appear here.
      </p>
    )
    if (bare) return empty
    return (
      <Card className="space-y-2">
        <Header />
        {empty}
      </Card>
    )
  }

  const { source, predictions, paces } = estimate

  const inner = (
    <>
      {!bare && <Header />}

      {/* Your single strongest effort, which sets the VDOT the training paces are
          prescribed from. It is deliberately NOT described as what the predictions
          rest on any more — each of those names its own source, because sourcing
          them all from one effort is what made a stale mile PR drive a marathon. */}
      <div className="flex items-baseline justify-between gap-2 rounded-xl bg-slate-800/60 p-2.5">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">
            {fromGarmin ? 'Garmin race predictor' : 'Strongest effort'}
            {!fromGarmin && source.fromRecord && ' · Garmin PR'}
          </p>
          <p className="truncate text-xs text-slate-300">
            {formatDuration(source.durationMin)} over {source.km.toFixed(2)} km
            {source.date !== '' && ` · ${monthDayLabel(source.date)}`}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-lg font-bold leading-none text-primary-400 tabular-nums">
            {(showingVo2 ? (vo2 as { value: number }).value : estimate.vdot).toFixed(1)}
          </p>
          <p className="text-[10px] text-slate-500">{showingVo2 ? 'VO₂ max' : 'VDOT'}</p>
        </div>
      </div>

      <p className="text-[10px] leading-relaxed text-slate-500">
        {showingVo2
          ? 'VO₂ max is your oxygen-uptake capacity, straight from your watch. It only updates from runs it records with heart rate.'
          : 'VDOT is worked back from your best effort, so it carries your running economy as well as your capacity — two runners with the same VO₂ max can have different VDOTs.'}
      </p>

      <div className="space-y-1">
        {predictions.map((p) => {
          const style = CONFIDENCE_STYLE[p.confidence]
          // A "low" rating means the nearest effort is more than 4x from this
          // distance — Riegel is unreliable that far out and would print an
          // over-optimistic time (a marathon from a 5K comes out faster per mile
          // than an easy long run). Better to say what's missing than to guess.
          const tooFar = p.confidence === 'low'
          const needLonger = p.km > p.source.km
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
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-medium text-slate-300">{p.label}</span>
                {/* Which effort this row rests on, or — when it's too far to trust —
                    what to log so a real prediction can appear. */}
                <span className="block truncate text-[10px] text-slate-500">
                  {tooFar
                    ? `Log a ${needLonger ? 'longer' : 'shorter, faster'} run to predict this`
                    : sourceNote(p.source)}
                </span>
              </span>
              {tooFar ? (
                <span className="shrink-0 text-right text-sm font-bold text-slate-600 tabular-nums">—</span>
              ) : (
                <>
                  <span className="shrink-0 text-right text-sm font-bold text-slate-100 tabular-nums">
                    {formatDuration(p.durationMin)}
                  </span>
                  <span className="w-16 shrink-0 text-right text-[11px] text-slate-500 tabular-nums">
                    {formatPace(p.pace)}/{distUnit}
                  </span>
                </>
              )}
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
          <ScrubChart
            data={trend}
            height={120}
            label={(t) => t.label}
            values={(t) =>
              t.vdot === null
                ? []
                : [
                    { key: 'score', name: showingVo2 ? 'VO₂ max' : 'VDOT', value: t.vdot.toFixed(1) },
                    ...(t.predicted5k !== null
                      ? [{ key: '5k', name: '5K', value: formatDuration(t.predicted5k), color: '#64748b' }]
                      : []),
                  ]
            }
            empty="no run recorded"
          >
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
                {/* connectNulls, because a quiet week is not a loss of fitness and
                    breaking the line there left isolated dots that read as broken
                    rendering. The dots still mark only the periods with real data,
                    so the gaps stay visible without implying a collapse. */}
                <Line
                  type="linear"
                  dataKey="vdot"
                  stroke="#38bdf8"
                  strokeWidth={2}
                  dot={{ r: 2.5, fill: '#38bdf8', strokeWidth: 0 }}
                  connectNulls
                  isAnimationActive={false}
                />
              </LineChart>
          </ScrubChart>
          <p className="text-[10px] text-slate-500">
            {showingVo2
              ? 'Best VO₂ max per period, as recorded by your watch. It only moves on runs it measures.'
              : fromGarmin
                ? "Best VDOT per period, from your watch's 5K prediction. Rising means you are getting fitter."
                : 'Best VDOT per period. Rising means you are getting fitter; gaps are periods with no run long enough to judge.'}
          </p>
        </div>
      )}

      <p className="text-[10px] leading-relaxed text-slate-500">
        {fromGarmin
          ? 'Straight from your watch — Garmin predicts each distance directly from your heart rate and training load, so none of these are extrapolated.'
          : "Riegel's model. Each distance is predicted from your nearest effort — green when that effort was close to the race, amber when it's a stretch. Distances too far from anything you've run recently show a dash instead of an unreliable guess. Your watch's own predictions will replace these once it has produced them."}
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
            Daniels' training intensities for VDOT {estimate.vdot.toFixed(1)}, derived from
            {fromGarmin ? " Garmin's 5K prediction" : ' your strongest effort'}. These always come
            from VDOT rather than VO₂ max — the pace tables are built on it, because a pace has to
            account for economy and not just capacity. Most weekly volume belongs in the easy band.
          </p>
        </div>
      )}
    </>
  )

  if (bare) return <div className="space-y-3">{inner}</div>
  return <Card className="space-y-3">{inner}</Card>
}

function Header() {
  return (
    <div className="flex items-center gap-2">
      <Gauge size={16} className="text-primary-400" />
      <h2 className="text-sm font-semibold text-slate-200">Race predictions</h2>
    </div>
  )
}

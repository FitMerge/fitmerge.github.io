import { useMemo, useState } from 'react'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
} from 'recharts'
import { Activity, Loader2, Sparkles } from 'lucide-react'
import Card from '../../components/Card'
import ScrubChart from '../../components/ScrubChart'
import Button from '../../components/Button'
import Sheet from '../../components/Sheet'
import SegmentedControl from '../../components/SegmentedControl'
import { useWorkoutsStore } from '../../store/workouts'
import { useHealthStore } from '../../store/health'
import { useSettingsStore } from '../../store/settings'
import { performanceManagementChart, projectPmc, formState, hasRealTrainingLoad } from '../../lib/trainingLoad'
import { coachSignals } from '../../lib/coachSignals'
import { explainCoachData, CoachError } from '../../services/coach/explain'
import { monthDayLabel } from './utils'

type RangeKey = '90d' | '180d' | '365d'

const RANGES: { key: RangeKey; label: string; days: number }[] = [
  { key: '90d', label: '3mo', days: 90 },
  { key: '180d', label: '6mo', days: 180 },
  { key: '365d', label: '1y', days: 365 },
]

const rangeToDays = (key: RangeKey): number => RANGES.find((r) => r.key === key)?.days ?? 180

const PROJECTION_DAYS = 28

// Fitness (CTL) uses a 42-day time constant, so below this many days of history
// the curve is still ramping up from its zero seed and understates the truth.
const CALIBRATION_DAYS = 42

const TONE_CLASSES: Record<string, string> = {
  good: 'text-emerald-400',
  warn: 'text-amber-400',
  bad: 'text-red-400',
  neutral: 'text-sky-400',
}

type Row = {
  date: string
  label: string
  ctl: number | null
  atl: number | null
  tsb: number | null
  ctlProj: number | null
  tsbProj: number | null
}

export default function FormFitnessSection() {
  const sessions = useWorkoutsStore((s) => s.sessions)
  const days = useHealthStore((s) => s.days)
  const geminiApiKey = useSettingsStore((s) => s.geminiApiKey)

  const [rangeKey, setRangeKey] = useState<RangeKey>('180d')
  const rangeDays = rangeToDays(rangeKey)
  const [explainOpen, setExplainOpen] = useState(false)
  const [explainState, setExplainState] = useState<'loading' | 'done' | 'error'>('loading')
  const [explainText, setExplainText] = useState('')

  const pmc = useMemo(() => performanceManagementChart(sessions), [sessions])
  const projection = useMemo(() => projectPmc(sessions, PROJECTION_DAYS), [sessions])
  const signals = useMemo(() => coachSignals(days), [days])
  const calibrated = useMemo(() => hasRealTrainingLoad(sessions), [sessions])

  const chartData = useMemo<Row[]>(() => {
    const actual: Row[] = pmc.slice(-rangeDays).map((p) => ({
      date: p.date,
      label: monthDayLabel(p.date),
      ctl: p.ctl,
      atl: p.atl,
      tsb: p.tsb,
      ctlProj: null,
      tsbProj: null,
    }))
    // Smooth Form for display: daily TSB sawtooths with every single workout,
    // which buries the actual trend. A centered 5-day average keeps the shape
    // without the noise (the stat tile still shows today's exact value).
    const tsbVals = actual.map((r) => r.tsb)
    actual.forEach((r, i) => {
      if (r.tsb === null) return
      let sum = 0
      let n = 0
      for (let j = Math.max(0, i - 2); j <= Math.min(tsbVals.length - 1, i + 2); j++) {
        const x = tsbVals[j]
        if (x !== null) {
          sum += x
          n++
        }
      }
      if (n) r.tsb = sum / n
    })
    if (actual.length && projection.length) {
      // Bridge: let the last actual point seed the dashed projection lines.
      const bridge = actual[actual.length - 1]
      bridge.ctlProj = bridge.ctl
      bridge.tsbProj = bridge.tsb
    }
    const proj: Row[] = projection.map((p) => ({
      date: p.date,
      label: monthDayLabel(p.date),
      ctl: null,
      atl: null,
      tsb: null,
      ctlProj: p.ctl,
      tsbProj: p.tsb,
    }))
    return [...actual, ...proj]
  }, [pmc, projection, rangeDays])

  if (pmc.length === 0) {
    return (
      <Card className="space-y-2">
        <SectionHeader />
        <p className="text-xs text-slate-500">
          Import workouts from Garmin (Settings → Connect health data) to see your fitness, fatigue and form
          over time.
        </p>
      </Card>
    )
  }

  const current = pmc[pmc.length - 1]
  const fs = formState(current.tsb)
  const projEnd = projection.length ? projection[projection.length - 1] : null
  const projFs = projEnd ? formState(projEnd.tsb) : null

  async function handleExplain() {
    setExplainOpen(true)
    setExplainState('loading')
    const recent = signals.map((s) => `- [${s.level}] ${s.title}: ${s.detail}`).join('\n')
    const summary = [
      `Date: ${current.date}`,
      `Fitness (CTL, 42-day load avg): ${current.ctl.toFixed(0)}`,
      `Fatigue (ATL, 7-day load avg): ${current.atl.toFixed(0)}`,
      `Form (TSB = fitness − fatigue): ${current.tsb.toFixed(0)} → ${fs.label}`,
      calibrated
        ? '(Load uses Garmin training-load values.)'
        : '(Load is estimated from activity calories, TSS-like units.)',
      projEnd ? `Projected in ${PROJECTION_DAYS} days at current load: Fitness ${projEnd.ctl.toFixed(0)}, Form ${projEnd.tsb.toFixed(0)} (${projFs?.label}).` : '',
      '',
      'Recent recovery signals:',
      recent,
    ].join('\n')
    try {
      const text = await explainCoachData(summary, geminiApiKey)
      setExplainText(text)
      setExplainState('done')
    } catch (err) {
      setExplainText(err instanceof CoachError ? err.message : 'Something went wrong.')
      setExplainState('error')
    }
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <SectionHeader />
        <Button variant="ghost" onClick={handleExplain} className="text-xs shrink-0">
          <span className="flex items-center gap-1">
            <Sparkles size={13} />
            Explain this
          </span>
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <StatTile label="Fitness" sub="CTL" value={current.ctl.toFixed(0)} tone="neutral" />
        <StatTile label="Fatigue" sub="ATL" value={current.atl.toFixed(0)} tone="warn" />
        <StatTile label="Form" sub="TSB" value={current.tsb > 0 ? `+${current.tsb.toFixed(0)}` : current.tsb.toFixed(0)} tone={fs.tone} />
      </div>

      <p className="text-xs text-slate-400">
        <span className={`font-semibold ${TONE_CLASSES[fs.tone]}`}>{fs.label}.</span> {fs.detail}
      </p>

      {/* The one-time "what am I even looking at" explainer — this chart is opaque
          without it. Colours match the three lines below. */}
      <p className="rounded-lg bg-slate-800/40 p-2.5 text-[11px] leading-relaxed text-slate-400">
        <span className="font-medium text-sky-400">Fitness</span> is your training load banked over about six
        weeks; <span className="font-medium text-amber-400">Fatigue</span> is just the last week;{' '}
        <span className="font-medium text-emerald-400">Form</span> = Fitness − Fatigue, i.e. how fresh you are.
        Positive Form means rested and ready to perform; negative means you're carrying fatigue — either
        building fitness or overdoing it. The dashed lines project the next four weeks at your current load.
      </p>

      {/* Fitness (CTL) and Form build from a zero seed over a ~42-day window, so
          until that much history exists the numbers read artificially low — even
          right after a Garmin backfill. Say so rather than let a new user read a
          climbing curve as "getting fitter" when it's really still warming up. */}
      {pmc.length < CALIBRATION_DAYS && (
        <p className="rounded-lg bg-amber-500/10 p-2 text-[11px] text-amber-300/90">
          Still calibrating. Fitness and Form start from zero and take about six weeks to settle, so
          for now they read low and will keep rising as more days build up — even with history imported
          from Garmin.
        </p>
      )}

      <SegmentedControl size="sm" options={RANGES} value={rangeKey} onChange={setRangeKey} ariaLabel="Form & fitness range" />

      <ScrubChart
        data={chartData}
        height={200}
        label={(p) => p.label}
        // The series runs 28 days into the future. "Latest" should mean the last
        // day that actually happened, not the end of a forecast.
        defaultIndex={chartData.map((p) => p.ctl != null).lastIndexOf(true)}
        values={(p) => {
          const ctl = p.ctl ?? p.ctlProj
          const tsb = p.tsb ?? p.tsbProj
          const projected = p.ctl == null && p.ctlProj != null
          if (ctl == null && tsb == null) return []
          return [
            ...(ctl != null
              ? [{ key: 'ctl', name: projected ? 'fitness (proj)' : 'fitness', value: ctl.toFixed(0), color: '#38bdf8' }]
              : []),
            ...(p.atl != null ? [{ key: 'atl', name: 'fatigue', value: p.atl.toFixed(0), color: '#fbbf24' }] : []),
            ...(tsb != null
              ? [{ key: 'tsb', name: 'form', value: `${tsb > 0 ? '+' : ''}${tsb.toFixed(0)}`, color: '#34d399' }]
              : []),
          ]
        }}
      >
          <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#1e293b" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={28} />
            <YAxis yAxisId="load" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} width={32} />
            <YAxis yAxisId="tsb" orientation="right" hide domain={['auto', 'auto']} />
            <ReferenceLine yAxisId="tsb" y={0} stroke="#334155" strokeDasharray="3 3" />
            <Area yAxisId="tsb" type="monotone" dataKey="tsb" name="Form" stroke="#34d399" fill="#34d399" fillOpacity={0.14} strokeWidth={2} connectNulls={false} />
            <Line yAxisId="load" type="monotone" dataKey="ctl" name="Fitness" stroke="#38bdf8" strokeWidth={2.5} dot={false} connectNulls={false} />
            <Line yAxisId="load" type="monotone" dataKey="atl" name="Fatigue" stroke="#fbbf24" strokeWidth={1} strokeOpacity={0.65} dot={false} strokeDasharray="4 2" connectNulls={false} />
            <Line yAxisId="load" type="monotone" dataKey="ctlProj" name="Projected fitness" stroke="#38bdf8" strokeWidth={1.5} dot={false} strokeDasharray="2 3" strokeOpacity={0.7} connectNulls />
            <Line yAxisId="tsb" type="monotone" dataKey="tsbProj" name="Projected form" stroke="#34d399" strokeWidth={1.5} dot={false} strokeDasharray="2 3" strokeOpacity={0.7} connectNulls />
          </ComposedChart>
      </ScrubChart>

      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-slate-400">
        <Legend color="#38bdf8" label="Fitness" />
        <Legend color="#fbbf24" label="Fatigue" />
        <Legend color="#34d399" label="Form" />
        <span className="text-slate-500">— — projected</span>
      </div>

      {projEnd && projFs && (
        <div className="rounded-lg bg-slate-800/60 p-2.5 text-xs text-slate-300">
          <span className="font-semibold text-slate-100">Forward view:</span> if you keep your current load,
          in {PROJECTION_DAYS} days your fitness trends to <span className="font-semibold text-sky-400">{projEnd.ctl.toFixed(0)}</span> and
          form to <span className={`font-semibold ${TONE_CLASSES[projFs.tone]}`}>{projEnd.tsb > 0 ? '+' : ''}{projEnd.tsb.toFixed(0)}</span> ({projFs.label}).
        </div>
      )}

      {!calibrated && (
        <p className="text-[10px] text-slate-500">
          Load estimated from activity calories. Re-run garmin-sync.py to pull Garmin's exact training load.
        </p>
      )}

      <Sheet open={explainOpen} onClose={() => setExplainOpen(false)} title="Coach interpretation">
        {explainState === 'loading' ? (
          <div className="flex flex-col items-center gap-2 py-8 text-slate-400">
            <Loader2 size={24} className="animate-spin text-primary-400" />
            <span className="text-sm">Reading your data…</span>
          </div>
        ) : (
          <div className={`whitespace-pre-wrap text-sm leading-relaxed ${explainState === 'error' ? 'text-amber-300' : 'text-slate-200'}`}>
            {explainText}
          </div>
        )}
      </Sheet>
    </Card>
  )
}

function SectionHeader() {
  return (
    <div className="flex items-center gap-2">
      <Activity size={16} className="text-sky-400" />
      <h2 className="text-sm font-semibold text-slate-200">Form &amp; Fitness</h2>
    </div>
  )
}

function StatTile({ label, sub, value, tone }: { label: string; sub: string; value: string; tone: string }) {
  return (
    <div className="rounded-lg bg-slate-800/60 p-2.5 text-center">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">
        {label} <span className="text-slate-600">· {sub}</span>
      </p>
      <p className={`mt-0.5 text-xl font-bold ${TONE_CLASSES[tone]}`}>{value}</p>
    </div>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  )
}

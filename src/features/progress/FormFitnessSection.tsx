import { useMemo, useState } from 'react'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Activity, Loader2, Sparkles } from 'lucide-react'
import Card from '../../components/Card'
import Button from '../../components/Button'
import Sheet from '../../components/Sheet'
import { useWorkoutsStore } from '../../store/workouts'
import { useHealthStore } from '../../store/health'
import { useSettingsStore } from '../../store/settings'
import { performanceManagementChart, formState } from '../../lib/trainingLoad'
import { coachSignals } from '../../lib/coachSignals'
import { explainCoachData, CoachError } from '../../services/coach/explain'
import { monthDayLabel } from './utils'

const RANGES: { key: string; label: string; days: number }[] = [
  { key: '90d', label: '3mo', days: 90 },
  { key: '180d', label: '6mo', days: 180 },
  { key: '365d', label: '1y', days: 365 },
]

const TONE_CLASSES: Record<string, string> = {
  good: 'text-emerald-400',
  warn: 'text-amber-400',
  bad: 'text-red-400',
  neutral: 'text-sky-400',
}

const SIGNAL_CLASSES: Record<string, string> = {
  red: 'border-red-500/60 bg-red-500/10',
  amber: 'border-amber-500/50 bg-amber-500/10',
  green: 'border-emerald-500/50 bg-emerald-500/10',
}

export default function FormFitnessSection() {
  const sessions = useWorkoutsStore((s) => s.sessions)
  const days = useHealthStore((s) => s.days)
  const geminiApiKey = useSettingsStore((s) => s.geminiApiKey)

  const [rangeDays, setRangeDays] = useState(180)
  const [explainOpen, setExplainOpen] = useState(false)
  const [explainState, setExplainState] = useState<'loading' | 'done' | 'error'>('loading')
  const [explainText, setExplainText] = useState('')

  const pmc = useMemo(() => performanceManagementChart(sessions), [sessions])
  const signals = useMemo(() => coachSignals(days), [days])

  const chartData = useMemo(
    () => pmc.slice(-rangeDays).map((p) => ({ ...p, label: monthDayLabel(p.date) })),
    [pmc, rangeDays],
  )

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

  async function handleExplain() {
    setExplainOpen(true)
    setExplainState('loading')
    const recent = signals.map((s) => `- [${s.level}] ${s.title}: ${s.detail}`).join('\n')
    const summary = [
      `Date: ${current.date}`,
      `Fitness (CTL, 42-day load avg): ${current.ctl.toFixed(0)}`,
      `Fatigue (ATL, 7-day load avg): ${current.atl.toFixed(0)}`,
      `Form (TSB = fitness − fatigue): ${current.tsb.toFixed(0)} → ${fs.label}`,
      `(Load is estimated from activity calories, TSS-like units.)`,
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

      <div className="flex gap-2">
        {RANGES.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => setRangeDays(r.days)}
            className={`flex-1 rounded-full py-1.5 text-xs font-medium ${
              rangeDays === r.days ? 'bg-primary-500 text-slate-950 font-semibold' : 'bg-slate-800 text-slate-300'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div style={{ height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#1e293b" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={28} />
            <YAxis yAxisId="load" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} width={32} />
            <YAxis yAxisId="tsb" orientation="right" hide domain={['auto', 'auto']} />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: '#cbd5e1' }}
              formatter={(v: number, name: string) => [v.toFixed(0), name]}
            />
            <ReferenceLine yAxisId="tsb" y={0} stroke="#334155" strokeDasharray="3 3" />
            <Area yAxisId="tsb" type="monotone" dataKey="tsb" name="Form" stroke="#34d399" fill="#34d399" fillOpacity={0.12} strokeWidth={1.5} />
            <Line yAxisId="load" type="monotone" dataKey="ctl" name="Fitness" stroke="#38bdf8" strokeWidth={2} dot={false} />
            <Line yAxisId="load" type="monotone" dataKey="atl" name="Fatigue" stroke="#fbbf24" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-center gap-4 text-[11px] text-slate-400">
        <Legend color="#38bdf8" label="Fitness" />
        <Legend color="#fbbf24" label="Fatigue" />
        <Legend color="#34d399" label="Form" />
      </div>

      {signals.length > 0 && (
        <div className="space-y-2 pt-1">
          {signals.map((sig, i) => (
            <div key={i} className={`rounded-lg border p-2.5 ${SIGNAL_CLASSES[sig.level]}`}>
              <p className="text-xs font-semibold text-slate-100">{sig.title}</p>
              <p className="text-[11px] text-slate-300">{sig.detail}</p>
            </div>
          ))}
        </div>
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

import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Flame } from 'lucide-react'
import Card from '../../components/Card'
import SegmentedControl from '../../components/SegmentedControl'
import { useHealthStore } from '../../store/health'
import { addDays, todayISO } from '../../lib/date'
import { metricSamples } from './healthTrends'
import { monthDayLabel } from './utils'

type RangeKey = '90d' | '180d' | '365d'

const RANGES: { key: RangeKey; label: string; days: number }[] = [
  { key: '90d', label: '3mo', days: 90 },
  { key: '180d', label: '6mo', days: 180 },
  { key: '365d', label: '1y', days: 365 },
]

const rangeToDays = (key: RangeKey): number => RANGES.find((r) => r.key === key)?.days ?? 90

type SplitPoint = { label: string; moderate: number; vigorous: number }
type TotalPoint = { label: string; total: number }

type IntensityData =
  | { mode: 'split'; points: SplitPoint[] }
  | { mode: 'total'; points: TotalPoint[] }
  | { mode: 'empty' }

/** Sum a per-day value map across a [start, end] inclusive week window. */
function sumWeek(byDate: Map<string, number>, start: string, end: string): number {
  let total = 0
  for (let d = start; d <= end; d = addDays(d, 1)) {
    total += byDate.get(d) ?? 0
  }
  return total
}

export default function IntensityDistributionSection() {
  const days = useHealthStore((s) => s.days)
  const [rangeKey, setRangeKey] = useState<RangeKey>('90d')
  const rangeDays = rangeToDays(rangeKey)

  const data = useMemo<IntensityData>(() => {
    const moderateSamples = metricSamples(days, 'moderateIntensityMinutes')
    const vigorousSamples = metricSamples(days, 'vigorousIntensityMinutes')

    const start = addDays(todayISO(), -(rangeDays - 1))

    if (moderateSamples.length > 0 || vigorousSamples.length > 0) {
      const moderateByDate = new Map(moderateSamples.map((s) => [s.date, s.value]))
      const vigorousByDate = new Map(vigorousSamples.map((s) => [s.date, s.value]))
      const points: SplitPoint[] = []
      for (let ws = start; ws <= todayISO(); ws = addDays(ws, 7)) {
        const we = addDays(ws, 6)
        points.push({
          label: monthDayLabel(ws),
          moderate: sumWeek(moderateByDate, ws, we),
          vigorous: sumWeek(vigorousByDate, ws, we),
        })
      }
      return { mode: 'split', points }
    }

    const intensitySamples = metricSamples(days, 'intensityMinutes')
    if (intensitySamples.length > 0) {
      const byDate = new Map(intensitySamples.map((s) => [s.date, s.value]))
      const points: TotalPoint[] = []
      for (let ws = start; ws <= todayISO(); ws = addDays(ws, 7)) {
        const we = addDays(ws, 6)
        points.push({ label: monthDayLabel(ws), total: sumWeek(byDate, ws, we) })
      }
      return { mode: 'total', points }
    }

    return { mode: 'empty' }
  }, [days, rangeDays])

  if (data.mode === 'empty') {
    return (
      <Card className="space-y-3">
        <SectionHeader />
        <p className="text-xs text-slate-500">
          Import Garmin data to see your training intensity distribution.
        </p>
      </Card>
    )
  }

  return (
    <Card className="space-y-3">
      <SectionHeader />

      <p className="text-xs text-slate-500">
        Weekly minutes at moderate vs vigorous effort. Most training should sit in moderate — spikes in
        vigorous load raise injury risk.
      </p>

      <SegmentedControl size="sm" options={RANGES} value={rangeKey} onChange={setRangeKey} ariaLabel="Intensity range" />

      <div style={{ height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.points} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#1e293b" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: '#64748b', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              minTickGap={20}
            />
            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} width={32} />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: '#cbd5e1' }}
            />
            {data.mode === 'split' ? (
              <>
                <Bar dataKey="moderate" stackId="a" fill="#38bdf8" name="Moderate" radius={[2, 2, 0, 0]} />
                <Bar dataKey="vigorous" stackId="a" fill="#f97316" name="Vigorous" radius={[2, 2, 0, 0]} />
              </>
            ) : (
              <Bar dataKey="total" fill="#38bdf8" name="Intensity minutes" radius={[2, 2, 0, 0]} />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-center gap-4 text-[11px] text-slate-400">
        {data.mode === 'split' ? (
          <>
            <Legend color="#38bdf8" label="Moderate" />
            <Legend color="#f97316" label="Vigorous" />
          </>
        ) : (
          <Legend color="#38bdf8" label="Intensity minutes" />
        )}
      </div>
    </Card>
  )
}

function SectionHeader() {
  return (
    <div className="flex items-center gap-2">
      <Flame size={16} className="text-orange-400" />
      <h2 className="text-sm font-semibold text-slate-200">Intensity distribution</h2>
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

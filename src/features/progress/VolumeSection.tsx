import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from 'recharts'
import Card from '../../components/Card'
import ScrubChart from '../../components/ScrubChart'
import { useWorkoutsStore } from '../../store/workouts'
import { useSettingsStore } from '../../store/settings'
import { weightUnitLabel } from '../workouts/utils'
import { isCardioSession } from '../workouts/cardio'
import { finishedSessionsInRange, totalSetsInRange, volumeSeries, type RangeKey } from './utils'

type VolumeSectionProps = {
  range: RangeKey
}

export default function VolumeSection({ range }: VolumeSectionProps) {
  const sessions = useWorkoutsStore((s) => s.sessions)
  const units = useSettingsStore((s) => s.units)
  const unitLabel = weightUnitLabel(units)

  // Lifting only — cardio sessions (imported runs/rides/etc.) live on the Cardio tab.
  const sessionsInRange = useMemo(
    () => finishedSessionsInRange(sessions, range).filter((s) => !isCardioSession(s)),
    [sessions, range],
  )
  const chartData = useMemo(() => volumeSeries(range, sessions), [range, sessions])
  const totalSets = useMemo(() => totalSetsInRange(sessionsInRange), [sessionsInRange])

  const nonZero = chartData.filter((p) => p.volume > 0)
  const avgVolume = nonZero.length ? nonZero.reduce((s, p) => s + p.volume, 0) / nonZero.length : 0
  // Raw pound/kilo totals get unreadable fast ("38000") — show "38k" instead.
  const kFmt = (v: number): string => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${Math.round(v)}`)

  return (
    <Card>
      <h2 className="text-sm font-semibold text-slate-200 mb-3">Training volume</h2>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="rounded-xl bg-slate-800/60 p-3">
          <p className="text-xs text-slate-500">Sessions</p>
          <p className="text-xl font-bold text-slate-100">{sessionsInRange.length}</p>
        </div>
        <div className="rounded-xl bg-slate-800/60 p-3">
          <p className="text-xs text-slate-500">Sets done</p>
          <p className="text-xl font-bold text-slate-100">{totalSets}</p>
        </div>
      </div>

      {chartData.every((p) => p.volume === 0) ? (
        <div className="py-2">
          <p className="text-sm text-slate-500">No finished workouts in this range yet.</p>
          <p className="mt-1 text-[11px] text-slate-600">Strength volume comes from workouts you log in the app — imported Garmin cardio doesn’t count here.</p>
        </div>
      ) : (
        <ScrubChart
          data={chartData}
          height={180}
          label={(p) => p.label}
          values={(p) =>
            p.volume > 0 ? [{ key: 'v', value: `${Math.round(p.volume).toLocaleString()} ${unitLabel}` }] : []
          }
          empty="no lifting"
        >
          <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#1e293b" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fill: '#64748b', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={36}
                tickFormatter={kFmt}
              />
              {avgVolume > 0 && (
                <ReferenceLine
                  y={avgVolume}
                  stroke="#64748b"
                  strokeDasharray="4 3"
                  label={{ value: 'avg', position: 'insideTopRight', fill: '#64748b', fontSize: 10 }}
                />
              )}
              <Bar dataKey="volume" fill="#818cf8" radius={[5, 5, 0, 0]} />
          </BarChart>
        </ScrubChart>
      )}
    </Card>
  )
}

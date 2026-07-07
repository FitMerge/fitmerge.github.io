import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import Card from '../../components/Card'
import { useWorkoutsStore } from '../../store/workouts'
import { useSettingsStore } from '../../store/settings'
import { weightUnitLabel } from '../workouts/utils'
import { finishedSessionsInRange, totalSetsInRange, volumeSeries, type RangeKey } from './utils'

type VolumeSectionProps = {
  range: RangeKey
}

export default function VolumeSection({ range }: VolumeSectionProps) {
  const sessions = useWorkoutsStore((s) => s.sessions)
  const units = useSettingsStore((s) => s.units)
  const unitLabel = weightUnitLabel(units)

  const sessionsInRange = useMemo(() => finishedSessionsInRange(sessions, range), [sessions, range])
  const chartData = useMemo(() => volumeSeries(range, sessions), [range, sessions])
  const totalSets = useMemo(() => totalSetsInRange(sessionsInRange), [sessionsInRange])

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
        <p className="text-sm text-slate-500 py-2">No finished workouts in this range yet.</p>
      ) : (
        <div style={{ height: 180 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#1e293b" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#cbd5e1' }}
                formatter={(value: number) => [`${Math.round(value)} ${unitLabel}`, 'Volume']}
              />
              <Bar dataKey="volume" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  )
}

// Weekly active time across ALL cardio activities (soccer, runs, walks, rides,
// hikes…) — the consistency view that per-activity pace charts can't show.

import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Timer } from 'lucide-react'
import Card from '../../components/Card'
import { useWorkoutsStore } from '../../store/workouts'
import { isCardioSession } from '../workouts/cardio'
import { addDays, todayISO } from '../../lib/date'
import { monthDayLabel } from './utils'

const WEEKS = 12

function fmtH(min: number): string {
  if (min >= 60) {
    const h = Math.floor(min / 60)
    const m = Math.round(min % 60)
    return m > 0 ? `${h}h ${m}m` : `${h}h`
  }
  return `${Math.round(min)}m`
}

export default function ActiveTimeSection() {
  const sessions = useWorkoutsStore((s) => s.sessions)

  const { weeks, thisWeekMin, thisWeekCount, avgMin } = useMemo(() => {
    const today = todayISO()
    const cardio = sessions.filter(isCardioSession)
    const weeks: { label: string; minutes: number }[] = []
    let thisWeekMin = 0
    let thisWeekCount = 0
    for (let w = WEEKS - 1; w >= 0; w--) {
      const start = addDays(today, -(w * 7 + 6))
      const end = addDays(today, -(w * 7))
      const inWeek = cardio.filter((s) => s.date >= start && s.date <= end)
      const minutes = inWeek.reduce((sum, s) => sum + (s.durationMin ?? 0), 0)
      weeks.push({ label: monthDayLabel(start), minutes })
      if (w === 0) {
        thisWeekMin = minutes
        thisWeekCount = inWeek.length
      }
    }
    const nonZero = weeks.filter((p) => p.minutes > 0)
    const avgMin = nonZero.length ? nonZero.reduce((s, p) => s + p.minutes, 0) / nonZero.length : 0
    return { weeks, thisWeekMin, thisWeekCount, avgMin }
  }, [sessions])

  if (weeks.every((w) => w.minutes === 0)) return null

  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-2">
        <Timer size={16} className="text-sky-400" />
        <h2 className="text-sm font-semibold text-slate-200">Active time per week</h2>
      </div>

      <div className="flex items-baseline justify-between">
        <p className="text-2xl font-bold text-slate-100">{fmtH(thisWeekMin)}</p>
        <p className="text-xs text-slate-400">
          this week · {thisWeekCount} session{thisWeekCount === 1 ? '' : 's'} · usual {fmtH(avgMin)}
        </p>
      </div>

      <div style={{ height: 150 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={weeks} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#1e293b" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={24} />
            <YAxis
              tick={{ fill: '#64748b', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={32}
              tickFormatter={(v: number) => (v >= 60 ? `${Math.round(v / 60)}h` : `${v}m`)}
            />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: '#cbd5e1' }}
              formatter={(v: number) => [fmtH(v), 'Active time']}
            />
            {avgMin > 0 && (
              <ReferenceLine y={avgMin} stroke="#64748b" strokeDasharray="4 3" label={{ value: 'usual', position: 'insideBottomLeft', fill: '#64748b', fontSize: 10 }} />
            )}
            <Bar dataKey="minutes" fill="#38bdf8" radius={[5, 5, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[11px] text-slate-500">Each bar is a week (label = week start). All cardio activities combined.</p>
    </Card>
  )
}

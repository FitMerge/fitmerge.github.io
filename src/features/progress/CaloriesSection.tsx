import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import Card from '../../components/Card'
import { useNutritionStore, entriesForDate } from '../../store/nutrition'
import { useSettingsStore } from '../../store/settings'
import { lastNDays } from '../../lib/date'
import { sumMacros } from '../../lib/macros'
import { monthDayLabel, rangeDays, type RangeKey } from './utils'

type CaloriesSectionProps = {
  range: RangeKey
}

function tickInterval(length: number): number {
  return length <= 8 ? 0 : Math.floor(length / 6)
}

export default function CaloriesSection({ range }: CaloriesSectionProps) {
  const entries = useNutritionStore((s) => s.entries)
  const goals = useSettingsStore((s) => s.goals)

  const days = useMemo(() => lastNDays(rangeDays(range)), [range])
  const hasAny = useMemo(() => entries.some((e) => days.includes(e.date)), [entries, days])

  const chartData = useMemo(
    () =>
      days.map((iso) => ({
        label: monthDayLabel(iso),
        calories: Math.round(sumMacros(entriesForDate(entries, iso)).calories),
      })),
    [days, entries],
  )

  return (
    <Card>
      <h2 className="text-sm font-semibold text-slate-200 mb-2">Calories</h2>
      {!hasAny ? (
        <p className="text-sm text-slate-500 py-4">No meals logged in this range yet.</p>
      ) : (
        <div style={{ height: 180 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#1e293b" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: '#64748b', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                interval={tickInterval(chartData.length)}
              />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#cbd5e1' }}
                formatter={(value: number) => [`${value} kcal`, 'Calories']}
              />
              <ReferenceLine
                y={goals.calories}
                stroke="#fbbf24"
                strokeDasharray="4 4"
                label={{ value: 'Goal', position: 'insideTopRight', fill: '#fbbf24', fontSize: 11 }}
              />
              <Bar dataKey="calories" fill="#38bdf8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  )
}

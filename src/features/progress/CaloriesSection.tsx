import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
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

const kFmt = (v: number): string => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`)

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

  // Average over logged days only, so skipped days don't drag it down.
  const logged = chartData.filter((p) => p.calories > 0)
  const avg = logged.length ? Math.round(logged.reduce((s, p) => s + p.calories, 0) / logged.length) : 0
  const overDays = logged.filter((p) => p.calories > goals.calories).length

  return (
    <Card>
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-slate-200">Calories</h2>
        {avg > 0 && (
          <p className="text-xs text-slate-400">
            avg <span className="font-semibold text-slate-200">{avg.toLocaleString()}</span> · goal{' '}
            {Math.round(goals.calories).toLocaleString()}
          </p>
        )}
      </div>
      {!hasAny ? (
        <p className="text-sm text-slate-500 py-4">No meals logged in this range yet.</p>
      ) : (
        <>
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
                <YAxis
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={38}
                  tickFormatter={kFmt}
                />
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#cbd5e1' }}
                  formatter={(value: number) => [`${value.toLocaleString()} kcal`, 'Calories']}
                />
                {/* extendDomain keeps the goal line visible even when every bar is under it. */}
                <ReferenceLine
                  y={goals.calories}
                  stroke="#fbbf24"
                  strokeDasharray="4 4"
                  ifOverflow="extendDomain"
                  label={{ value: 'Goal', position: 'insideTopRight', fill: '#fbbf24', fontSize: 11 }}
                />
                <Bar dataKey="calories" radius={[4, 4, 0, 0]}>
                  {chartData.map((p) => (
                    <Cell key={p.label} fill={p.calories > goals.calories ? '#fbbf24' : '#38bdf8'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {logged.length > 0 && (
            <p className="mt-1.5 text-[11px] text-slate-500">
              {overDays === 0
                ? `Under goal on all ${logged.length} logged day${logged.length === 1 ? '' : 's'}.`
                : `Over goal on ${overDays} of ${logged.length} logged days (amber bars).`}
            </p>
          )}
        </>
      )}
    </Card>
  )
}

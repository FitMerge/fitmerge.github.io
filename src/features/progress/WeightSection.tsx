import { useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowDown, ArrowUp, Plus, Scale, Trash2 } from 'lucide-react'
import Card from '../../components/Card'
import Button from '../../components/Button'
import Sheet from '../../components/Sheet'
import EmptyState from '../../components/EmptyState'
import LogWeightSheet from './LogWeightSheet'
import { useBodyStore } from '../../store/body'
import { useSettingsStore } from '../../store/settings'
import { isoToLabel } from '../../lib/date'
import {
  convertWeight,
  entriesInRange,
  lastNEntries,
  weightSeries,
  weightUnit,
  type RangeKey,
} from './utils'

type WeightSectionProps = {
  range: RangeKey
}

export default function WeightSection({ range }: WeightSectionProps) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const entries = useBodyStore((s) => s.entries)
  const removeEntry = useBodyStore((s) => s.removeEntry)
  const units = useSettingsStore((s) => s.units)
  const unitLabel = weightUnit(units)

  const chartData = useMemo(() => weightSeries(entries, range, units), [entries, range, units])
  const rangeEntries = useMemo(() => entriesInRange(entries, range), [entries, range])
  const recentEntries = useMemo(() => lastNEntries(entries, 5), [entries])

  const latestEntry = recentEntries[0]
  const hasDelta = rangeEntries.length >= 2
  const deltaKg = hasDelta ? rangeEntries[rangeEntries.length - 1].weightKg - rangeEntries[0].weightKg : 0
  const delta = convertWeight(deltaKg, units)

  if (entries.length === 0) {
    return (
      <Card>
        <h2 className="text-sm font-semibold text-slate-200 mb-1">Weight</h2>
        <EmptyState
          icon={Scale}
          title="Log your first weigh-in"
          subtitle="Track your weight over time to see trends."
          action={
            <Button variant="primary" full onClick={() => setSheetOpen(true)}>
              + Log weight
            </Button>
          }
        />
        <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Log weight">
          <LogWeightSheet onClose={() => setSheetOpen(false)} />
        </Sheet>
      </Card>
    )
  }

  return (
    <Card>
      <div className="flex items-start justify-between mb-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-200">Weight</h2>
          {latestEntry && (
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-bold text-slate-100">
                {convertWeight(latestEntry.weightKg, units).toFixed(1)}
                <span className="text-sm font-medium text-slate-400 ml-1">{unitLabel}</span>
              </span>
              {hasDelta && Math.abs(delta) > 0.05 && (
                <span
                  className={`flex items-center text-xs font-medium ${
                    delta > 0 ? 'text-amber-400' : 'text-primary-400'
                  }`}
                >
                  {delta > 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                  {Math.abs(delta).toFixed(1)} {unitLabel}
                </span>
              )}
            </div>
          )}
        </div>
        <Button variant="ghost" onClick={() => setSheetOpen(true)} className="text-xs shrink-0">
          <span className="flex items-center gap-1">
            <Plus size={14} />
            Log weight
          </span>
        </Button>
      </div>

      <div style={{ height: 180 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#1e293b" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fill: '#64748b', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              domain={['auto', 'auto']}
              width={44}
              tickFormatter={(value: number) => value.toFixed(0)}
            />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: '#cbd5e1' }}
              formatter={(value: number) => [`${value.toFixed(1)} ${unitLabel}`, 'Weight']}
            />
            <Line
              type="monotone"
              dataKey="weight"
              stroke="#34d399"
              strokeWidth={2}
              dot={{ r: 3, fill: '#34d399' }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 space-y-1">
        {recentEntries.map((entry) => (
          <div key={entry.date} className="flex items-center justify-between py-1.5 border-t border-slate-800/60">
            <div>
              <p className="text-sm text-slate-200">{isoToLabel(entry.date)}</p>
              <p className="text-xs text-slate-500">
                {convertWeight(entry.weightKg, units).toFixed(1)} {unitLabel}
                {entry.bodyFatPct !== undefined ? ` · ${entry.bodyFatPct}% BF` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={() => removeEntry(entry.date)}
              aria-label={`Delete entry for ${entry.date}`}
              className="w-8 h-8 rounded-full bg-slate-800 active:bg-slate-700 flex items-center justify-center text-red-400"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Log weight">
        <LogWeightSheet onClose={() => setSheetOpen(false)} />
      </Sheet>
    </Card>
  )
}

import { useMemo, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from 'recharts'
import { ArrowDown, ArrowUp, Flag, Plus, Scale, Target, Trash2 } from 'lucide-react'
import Card from '../../components/Card'
import ScrubChart from '../../components/ScrubChart'
import Button from '../../components/Button'
import Sheet from '../../components/Sheet'
import SegmentedControl from '../../components/SegmentedControl'
import EmptyState from '../../components/EmptyState'
import NumberField from '../../components/NumberField'
import LogWeightSheet from './LogWeightSheet'
import { useBodyStore } from '../../store/body'
import { useSettingsStore } from '../../store/settings'
import { isoToLabel } from '../../lib/date'
import { convertWeight, lbToKg, weightUnit } from '../../lib/units'
import { lastNEntries } from './utils'
import { WEIGHT_RANGE_OPTIONS, weightStats, weightTrendData, type WeightRangeKey } from './weightTrends'

function longDateLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function WeightSection() {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [goalOpen, setGoalOpen] = useState(false)
  const [range, setRange] = useState<WeightRangeKey>('90d')
  const entries = useBodyStore((s) => s.entries)
  const removeEntry = useBodyStore((s) => s.removeEntry)
  const units = useSettingsStore((s) => s.units)
  const goalWeightKg = useSettingsStore((s) => s.goalWeightKg)
  const unitLabel = weightUnit(units)

  const goalDisplay = goalWeightKg !== undefined ? convertWeight(goalWeightKg, units) : undefined
  const chartData = useMemo(() => weightTrendData(entries, range, units), [entries, range, units])
  const stats = useMemo(() => weightStats(entries, range, units, goalDisplay), [entries, range, units, goalDisplay])
  const recentEntries = useMemo(() => lastNEntries(entries, 5), [entries])

  // Y domain spans the data and — when set — the goal, so the goal reference line is
  // always visible even when it's well below the current weight.
  const yDomain = useMemo<[number, number]>(() => {
    const vals: number[] = []
    for (const p of chartData) {
      if (p.weight !== null) vals.push(p.weight)
      if (p.trend !== null) vals.push(p.trend)
    }
    if (goalDisplay !== undefined) vals.push(goalDisplay)
    if (vals.length === 0) return [0, 1]
    const min = Math.min(...vals)
    const max = Math.max(...vals)
    const pad = Math.max((max - min) * 0.08, 0.5)
    return [Math.floor(min - pad), Math.ceil(max + pad)]
  }, [chartData, goalDisplay])

  if (entries.length === 0) {
    return (
      <Card>
        <h2 className="text-sm font-semibold text-slate-200 mb-1">Weight</h2>
        <EmptyState
          icon={Scale}
          title="Log your first weigh-in"
          subtitle="Track your weight over time to see a smoothed trend, your rate of change, and progress toward a goal."
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

  const rate = stats?.ratePerWeek ?? 0
  const losing = rate < 0
  const showRate = Math.abs(rate) >= 0.05

  return (
    <Card>
      <div className="flex items-start justify-between mb-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-200">Weight</h2>
          {stats && (
            <div className="mt-0.5 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-100">
                {stats.trend.toFixed(1)}
                <span className="ml-1 text-sm font-medium text-slate-400">{unitLabel}</span>
              </span>
              <span className="text-[11px] text-slate-500">trend</span>
              {showRate && (
                <span
                  className={`flex items-center text-xs font-medium ${losing ? 'text-primary-400' : 'text-amber-400'}`}
                >
                  {losing ? <ArrowDown size={12} /> : <ArrowUp size={12} />}
                  {Math.abs(rate).toFixed(1)} {unitLabel}/wk
                </span>
              )}
            </div>
          )}
        </div>
        <Button variant="ghost" onClick={() => setSheetOpen(true)} className="shrink-0 text-xs">
          <span className="flex items-center gap-1">
            <Plus size={14} />
            Log
          </span>
        </Button>
      </div>

      {/* Range selector */}
      <SegmentedControl
        size="sm"
        options={WEIGHT_RANGE_OPTIONS}
        value={range}
        onChange={setRange}
        ariaLabel="Weight range"
        className="mb-3"
      />

      {/* Goal progress */}
      <button
        type="button"
        onClick={() => setGoalOpen(true)}
        className="mb-3 flex w-full items-center gap-2 rounded-lg bg-slate-800/60 px-3 py-2 text-left active:bg-slate-800"
      >
        <Target size={15} className="shrink-0 text-primary-400" />
        {goalDisplay === undefined ? (
          <span className="text-xs text-slate-400">Set a goal weight to track progress →</span>
        ) : (
          <span className="text-xs text-slate-300">
            Goal <span className="font-semibold text-slate-100">{goalDisplay.toFixed(1)} {unitLabel}</span>
            {stats?.toGoal !== null && stats?.toGoal !== undefined && Math.abs(stats.toGoal) >= 0.1 && (
              <span className="text-slate-400">
                {' · '}
                {Math.abs(stats.toGoal).toFixed(1)} {unitLabel} to go
              </span>
            )}
            {stats?.projectedDate && (
              <span className="text-slate-500"> · ~{longDateLabel(stats.projectedDate)}</span>
            )}
          </span>
        )}
      </button>

      <ScrubChart
        data={chartData}
        height={190}
        label={(p) => p.label}
        values={(p) => [
          ...(p.weight != null ? [{ key: 'w', name: 'weigh-in', value: `${p.weight.toFixed(1)} ${unitLabel}` }] : []),
          ...(p.trend != null
            ? [{ key: 't', name: 'trend', value: `${p.trend.toFixed(1)} ${unitLabel}`, color: '#34d399' }]
            : []),
        ]}
        empty="no weigh-in"
      >
          <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#1e293b" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: '#64748b', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              minTickGap={28}
            />
            <YAxis
              tick={{ fill: '#64748b', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              domain={yDomain}
              width={40}
              tickFormatter={(value: number) => value.toFixed(0)}
            />
            {goalDisplay !== undefined && (
              <ReferenceLine
                y={goalDisplay}
                stroke="#38bdf8"
                strokeDasharray="5 4"
                strokeWidth={1.5}
                label={{ value: 'Goal', fill: '#38bdf8', fontSize: 10, position: 'insideTopRight' }}
              />
            )}
            {/* Raw weigh-ins: faint dots behind the trend line. */}
            <Line
              type="monotone"
              dataKey="weight"
              stroke="#475569"
              strokeWidth={1}
              dot={{ r: 2, fill: '#64748b' }}
              connectNulls
              isAnimationActive={false}
            />
            {/* Smoothed trend: the headline line. */}
            <Line
              type="monotone"
              dataKey="trend"
              stroke="#34d399"
              strokeWidth={2.5}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          </LineChart>
      </ScrubChart>
      <p className="mt-1 text-center text-[11px] text-slate-500">
        Bold line = smoothed trend · dots = actual weigh-ins
      </p>

      <div className="mt-3 space-y-1">
        {recentEntries.map((entry) => (
          <div key={entry.date} className="flex items-center justify-between border-t border-slate-800/60 py-1.5">
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
              className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-red-400 active:bg-slate-700"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Log weight">
        <LogWeightSheet onClose={() => setSheetOpen(false)} />
      </Sheet>
      <GoalWeightSheet open={goalOpen} onClose={() => setGoalOpen(false)} />
    </Card>
  )
}

function GoalWeightSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const units = useSettingsStore((s) => s.units)
  const goalWeightKg = useSettingsStore((s) => s.goalWeightKg)
  const setGoalWeightKg = useSettingsStore((s) => s.setGoalWeightKg)
  const unitLabel = weightUnit(units)
  const initial = goalWeightKg !== undefined ? Math.round(convertWeight(goalWeightKg, units) * 10) / 10 : Math.round(convertWeight(70, units))
  const [goal, setGoal] = useState(initial)

  function save() {
    if (goal > 0) setGoalWeightKg(units === 'imperial' ? lbToKg(goal) : goal)
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title="Goal weight">
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Flag size={15} className="text-primary-400" />
          Set a target and FitMerge projects when you'll reach it from your current trend.
        </div>
        <NumberField
          label="Goal weight"
          value={goal}
          onChange={setGoal}
          step={units === 'imperial' ? 1 : 0.5}
          min={0}
          suffix={unitLabel}
        />
        <div className="flex gap-2">
          {goalWeightKg !== undefined && (
            <Button
              variant="ghost"
              full
              onClick={() => {
                setGoalWeightKg(undefined)
                onClose()
              }}
            >
              Clear goal
            </Button>
          )}
          <Button variant="primary" full onClick={save}>
            Save goal
          </Button>
        </div>
      </div>
    </Sheet>
  )
}

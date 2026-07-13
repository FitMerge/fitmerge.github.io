import { useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Minus, Ruler, TrendingDown, TrendingUp } from 'lucide-react'
import Card from '../../components/Card'
import Button from '../../components/Button'
import Sheet from '../../components/Sheet'
import LogMeasurementsSheet from './LogMeasurementsSheet'
import { useBodyStore } from '../../store/body'
import { useSettingsStore } from '../../store/settings'
import { MEASUREMENTS, fromCm, lengthUnitLabel, measurementLabel } from '../../data/measurements'
import { monthDayLabel } from './utils'
import type { MeasurementEntry } from '../../types'

type SeriesPoint = { date: string; label: string; value: number }

/** Recorded values for one measurement id, oldest → newest, converted to display units. */
function seriesFor(measurements: MeasurementEntry[], id: string, imperial: boolean): SeriesPoint[] {
  return measurements
    .filter((m) => m.values[id] != null)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((m) => ({
      date: m.date,
      label: monthDayLabel(m.date),
      value: fromCm(m.values[id], imperial),
    }))
}

export default function MeasurementsSection() {
  const measurements = useBodyStore((s) => s.measurements)
  const units = useSettingsStore((s) => s.units)
  const imperial = units === 'imperial'
  const unitLabel = lengthUnitLabel(imperial)

  const [logOpen, setLogOpen] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)

  // Measurements (in catalog order) that have at least one recorded value.
  const tiles = useMemo(() => {
    return [...MEASUREMENTS]
      .sort((a, b) => a.order - b.order)
      .map((def) => ({ def, series: seriesFor(measurements, def.id, imperial) }))
      .filter((t) => t.series.length > 0)
  }, [measurements, imperial])

  const selectedSeries = useMemo(
    () => (selected ? seriesFor(measurements, selected, imperial) : []),
    [measurements, selected, imperial],
  )

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Ruler size={16} className="text-primary-400" />
          <h2 className="text-sm font-semibold text-slate-200">Body measurements</h2>
        </div>
        <Button variant="ghost" onClick={() => setLogOpen(true)} className="text-xs shrink-0 py-1.5">
          Log
        </Button>
      </div>

      {tiles.length === 0 ? (
        <p className="text-xs text-slate-500">Track chest, arms, waist and more. Tap Log to start.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {tiles.map(({ def, series }) => {
            const latest = series[series.length - 1].value
            const prev = series.length >= 2 ? series[series.length - 2].value : null
            const delta = prev !== null ? latest - prev : 0
            return (
              <button
                key={def.id}
                type="button"
                onClick={() => setSelected(def.id)}
                className="rounded-xl bg-slate-800/60 p-3 text-left active:bg-slate-800"
              >
                <p className="truncate text-xs text-slate-400">{def.label}</p>
                <div className="flex items-baseline gap-1.5">
                  <p className="text-lg font-bold text-slate-100">
                    {latest.toFixed(1)}
                    <span className="ml-1 text-xs font-medium text-slate-500">{unitLabel}</span>
                  </p>
                  <TrendArrow delta={prev === null ? null : delta} />
                </div>
              </button>
            )
          })}
        </div>
      )}

      <LogMeasurementsSheet open={logOpen} onClose={() => setLogOpen(false)} />

      <Sheet
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected ? measurementLabel(selected) : 'Measurement'}
      >
        {selected && <MeasurementDetail series={selectedSeries} unitLabel={unitLabel} />}
      </Sheet>
    </Card>
  )
}

function TrendArrow({ delta }: { delta: number | null }) {
  if (delta === null || Math.abs(delta) < 0.05) {
    return <Minus size={12} className="text-slate-500" />
  }
  return delta > 0 ? (
    <TrendingUp size={12} className="text-emerald-400" />
  ) : (
    <TrendingDown size={12} className="text-red-400" />
  )
}

function MeasurementDetail({ series, unitLabel }: { series: SeriesPoint[]; unitLabel: string }) {
  if (series.length < 2) {
    const latest = series[series.length - 1]
    return (
      <div className="space-y-4">
        {latest && (
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Latest" value={`${latest.value.toFixed(1)} ${unitLabel}`} />
          </div>
        )}
        <p className="py-6 text-center text-sm text-slate-500">Log more to see a trend.</p>
      </div>
    )
  }

  const latest = series[series.length - 1].value
  const first = series[0].value
  const change = latest - first

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Latest" value={`${latest.toFixed(1)} ${unitLabel}`} />
        <Stat
          label="Change"
          value={`${change >= 0 ? '+' : ''}${change.toFixed(1)} ${unitLabel}`}
        />
      </div>

      <div style={{ height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={series} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#1e293b" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: '#64748b', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              minTickGap={24}
            />
            <YAxis
              tick={{ fill: '#64748b', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              domain={['auto', 'auto']}
              width={44}
              tickFormatter={(v: number) => v.toFixed(0)}
            />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: '#cbd5e1' }}
              formatter={(v: number) => [`${v.toFixed(1)} ${unitLabel}`, '']}
            />
            <Line type="monotone" dataKey="value" stroke="#34d399" strokeWidth={2} dot={{ r: 3, fill: '#34d399' }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-800/60 p-2.5 text-center">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm font-bold text-slate-100">{value}</p>
    </div>
  )
}

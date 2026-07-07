import { useState } from 'react'
import Button from '../../components/Button'
import NumberField from '../../components/NumberField'
import { useBodyStore } from '../../store/body'
import { useSettingsStore } from '../../store/settings'
import { todayISO } from '../../lib/date'
import { convertWeight, lbToKg, weightUnit } from './utils'

type LogWeightSheetProps = {
  onClose: () => void
}

export default function LogWeightSheet({ onClose }: LogWeightSheetProps) {
  const units = useSettingsStore((s) => s.units)
  const upsertEntry = useBodyStore((s) => s.upsertEntry)

  const [date, setDate] = useState(todayISO())
  const [weight, setWeight] = useState(Math.round(convertWeight(75, units) * 10) / 10)
  const [trackBodyFat, setTrackBodyFat] = useState(false)
  const [bodyFatPct, setBodyFatPct] = useState(15)

  function handleSave() {
    if (weight <= 0) return
    const weightKg = units === 'imperial' ? lbToKg(weight) : weight
    upsertEntry({
      date,
      weightKg,
      bodyFatPct: trackBodyFat ? bodyFatPct : undefined,
    })
    onClose()
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm text-slate-400 mb-1">Date</label>
        <input
          type="date"
          value={date}
          max={todayISO()}
          onChange={(e) => setDate(e.target.value)}
          className="w-full bg-slate-800 rounded-lg px-3 py-2.5 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-primary-500 [color-scheme:dark]"
        />
      </div>

      <NumberField
        label="Weight"
        value={weight}
        onChange={setWeight}
        step={units === 'imperial' ? 0.5 : 0.1}
        min={0}
        suffix={weightUnit(units)}
      />

      <label className="flex items-center gap-2 text-sm text-slate-300">
        <input
          type="checkbox"
          checked={trackBodyFat}
          onChange={(e) => setTrackBodyFat(e.target.checked)}
          className="h-4 w-4 rounded accent-primary-500"
        />
        Track body fat %
      </label>

      {trackBodyFat && (
        <NumberField label="Body fat" value={bodyFatPct} onChange={setBodyFatPct} step={0.5} min={0} suffix="%" />
      )}

      <Button variant="primary" full onClick={handleSave}>
        Save
      </Button>
    </div>
  )
}

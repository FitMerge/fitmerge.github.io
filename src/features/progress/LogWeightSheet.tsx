import { useState } from 'react'
import Button from '../../components/Button'
import NumberField from '../../components/NumberField'
import RulerPicker from '../../components/RulerPicker'
import { useBodyStore } from '../../store/body'
import { useSettingsStore } from '../../store/settings'
import { todayISO } from '../../lib/date'
import { latestBodyWeightKg } from '../../lib/exercise'
import { convertWeight, lbToKg, weightUnit } from './utils'

type LogWeightSheetProps = {
  onClose: () => void
}

export default function LogWeightSheet({ onClose }: LogWeightSheetProps) {
  const units = useSettingsStore((s) => s.units)
  const entries = useBodyStore((s) => s.entries)
  const upsertEntry = useBodyStore((s) => s.upsertEntry)

  const isImperial = units === 'imperial'
  // Start the wheel at the last weight you logged — the most likely next value.
  const startWeight = Math.round(convertWeight(latestBodyWeightKg(entries), units) * 10) / 10

  const [date, setDate] = useState(todayISO())
  const [weight, setWeight] = useState(startWeight)
  const [trackBodyFat, setTrackBodyFat] = useState(false)
  const [bodyFatPct, setBodyFatPct] = useState(15)

  function handleSave() {
    if (weight <= 0) return
    const weightKg = isImperial ? lbToKg(weight) : weight
    upsertEntry({ date, weightKg, bodyFatPct: trackBodyFat ? bodyFatPct : undefined })
    onClose()
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-sm text-slate-400">Date</label>
        <input
          type="date"
          value={date}
          max={todayISO()}
          onChange={(e) => setDate(e.target.value)}
          className="w-full rounded-lg bg-slate-800 px-3 py-2.5 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-primary-500 [color-scheme:dark]"
        />
      </div>

      <div className="pt-1">
        <RulerPicker
          value={weight}
          onChange={setWeight}
          min={isImperial ? 50 : 20}
          max={isImperial ? 500 : 250}
          step={0.1}
          unit={weightUnit(units)}
        />
      </div>

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

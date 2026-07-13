import { useMemo, useState } from 'react'
import Sheet from '../../components/Sheet'
import Button from '../../components/Button'
import NumberField from '../../components/NumberField'
import { useBodyStore } from '../../store/body'
import { useSettingsStore } from '../../store/settings'
import { MEASUREMENTS, fromCm, lengthUnitLabel, toCm } from '../../data/measurements'
import { todayISO } from '../../lib/date'

type Props = {
  open: boolean
  onClose: () => void
}

export default function LogMeasurementsSheet({ open, onClose }: Props) {
  const measurements = useBodyStore((s) => s.measurements)
  const upsertMeasurement = useBodyStore((s) => s.upsertMeasurement)
  const units = useSettingsStore((s) => s.units)
  const imperial = units === 'imperial'

  const today = todayISO()

  const initial = useMemo(() => {
    const existing = measurements.find((m) => m.date === today)
    const out: Record<string, number> = {}
    for (const def of MEASUREMENTS) {
      const cm = existing?.values[def.id]
      out[def.id] = cm != null ? Math.round(fromCm(cm, imperial) * 10) / 10 : 0
    }
    return out
  }, [measurements, today, imperial])

  const [draft, setDraft] = useState<Record<string, number>>(initial)

  // Reset the draft whenever the sheet is (re)opened for a fresh prefill.
  const [openedFor, setOpenedFor] = useState(open)
  if (open !== openedFor) {
    setOpenedFor(open)
    if (open) setDraft(initial)
  }

  const suffix = lengthUnitLabel(imperial)
  const step = imperial ? 0.5 : 1

  function handleSave() {
    const values: Record<string, number> = {}
    for (const def of MEASUREMENTS) {
      const v = draft[def.id]
      if (v > 0) values[def.id] = toCm(v, imperial)
    }
    if (Object.keys(values).length > 0) {
      upsertMeasurement(today, values)
    }
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title="Log measurements">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {MEASUREMENTS.map((def) => (
            <NumberField
              key={def.id}
              label={def.label}
              value={draft[def.id] ?? 0}
              onChange={(v) => setDraft((prev) => ({ ...prev, [def.id]: v }))}
              step={step}
              min={0}
              suffix={suffix}
            />
          ))}
        </div>
        <Button variant="primary" full onClick={handleSave}>
          Save
        </Button>
      </div>
    </Sheet>
  )
}

import { useState } from 'react'
import Sheet from '../../components/Sheet'
import Button from '../../components/Button'
import NumberField from '../../components/NumberField'
import { useWorkoutsStore } from '../../store/workouts'
import { useSettingsStore } from '../../store/settings'
import { todayISO } from '../../lib/date'
import { distanceUnitLabel } from './cardio'

const KM_PER_MILE = 1.60934

/**
 * Log something you did that isn't a tracked lifting session — a run, a yoga
 * class, a hike. Deliberately minimal: a free-text name plus minutes and
 * calories, an editable date, and an optional distance. Writes a finished
 * WorkoutSession, so it shows up in cardio, the activity feed and coaching, and
 * its calories feed the day's budget.
 */
export default function LogActivitySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const logActivity = useWorkoutsStore((s) => s.logActivity)
  const units = useSettingsStore((s) => s.units)
  const distUnit = distanceUnitLabel(units)

  const [name, setName] = useState('')
  const [date, setDate] = useState(todayISO())
  const [minutes, setMinutes] = useState(0)
  const [calories, setCalories] = useState(0)
  const [distance, setDistance] = useState(0)

  function reset() {
    setName('')
    setDate(todayISO())
    setMinutes(0)
    setCalories(0)
    setDistance(0)
  }

  function close() {
    onClose()
    // Clear after the close animation so it reopens blank.
    setTimeout(reset, 250)
  }

  function submit() {
    const trimmed = name.trim()
    if (!trimmed) return
    const distanceKm = distance > 0 ? (units === 'imperial' ? distance * KM_PER_MILE : distance) : undefined
    logActivity({
      name: trimmed,
      date,
      durationMin: minutes > 0 ? minutes : undefined,
      kcal: calories > 0 ? calories : undefined,
      distanceKm,
    })
    close()
  }

  return (
    <Sheet open={open} onClose={close} title="Log activity">
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm text-slate-400">Activity</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Yoga, trail run, pickup basketball"
            className="w-full rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-slate-400">Date</label>
          <input
            type="date"
            value={date}
            max={todayISO()}
            onChange={(e) => setDate(e.target.value || todayISO())}
            className="w-full rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-primary-500 [color-scheme:dark]"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <NumberField label="Duration" value={minutes} onChange={setMinutes} step={5} min={0} suffix="min" />
          <NumberField label="Calories" value={calories} onChange={setCalories} step={10} min={0} suffix="kcal" />
        </div>

        <NumberField
          label="Distance (optional)"
          value={distance}
          onChange={setDistance}
          step={0.5}
          min={0}
          suffix={distUnit}
        />

        <Button variant="primary" full onClick={submit} disabled={!name.trim()}>
          Log activity
        </Button>
      </div>
    </Sheet>
  )
}

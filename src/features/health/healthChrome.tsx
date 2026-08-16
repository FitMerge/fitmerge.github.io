// Shared chrome for the three health tabs (Weight, Performance, Vitals) that were
// split out of the old single Health tab: a common header and the "no data yet"
// connect prompt, so each tab looks like one family without duplicating markup.

import { useNavigate } from 'react-router-dom'
import { HeartPulse, type LucideIcon } from 'lucide-react'
import Card from '../../components/Card'
import Button from '../../components/Button'
import { isoToLabel } from '../../lib/date'

export function HealthHeader({
  title,
  blurb,
  latestDate,
  icon: Icon = HeartPulse,
  iconClass = 'text-rose-400',
}: {
  title: string
  blurb: string
  latestDate?: string | null
  icon?: LucideIcon
  iconClass?: string
}) {
  return (
    <header className="flex items-end justify-between">
      <div>
        <h1 className="text-xl font-bold text-slate-100">{title}</h1>
        <p className="text-sm text-slate-400">
          {latestDate ? `Updated ${isoToLabel(latestDate)} · ${blurb}` : blurb}
        </p>
      </div>
      <Icon size={22} className={`mb-1 ${iconClass}`} />
    </header>
  )
}

/** The "no data yet" card — worded to how this person actually tracks. */
export function ConnectPrompt({ trackingSource }: { trackingSource?: string }) {
  const navigate = useNavigate()
  const manual = trackingSource === 'manual'
  return (
    <Card className="space-y-3 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
        <HeartPulse size={26} />
      </div>
      <h2 className="text-base font-semibold text-slate-100">
        {manual ? 'Track sleep and steps' : 'Connect your health data'}
      </h2>
      <p className="text-sm text-slate-400">
        {manual
          ? 'Log your sleep and steps from the + button and they’ll build into trends here. Everything else — meals, workouts, water and weight — already works without a watch.'
          : trackingSource === 'apple'
            ? 'Export your data from the Apple Health app, then import the zip to see sleep, workouts and weight as live trends.'
            : trackingSource === 'other'
              ? 'Import a CSV or JSON export from your tracker to see sleep, heart rate and activity as live trends.'
              : 'Import from Garmin or Apple Health to see Body Battery, readiness, sleep, HRV, stress, VO₂ max, steps and more — each as a live trend.'}
      </p>
      <Button variant="primary" full onClick={() => navigate('/settings')}>
        {manual ? 'Open settings' : 'Connect health data'}
      </Button>
    </Card>
  )
}

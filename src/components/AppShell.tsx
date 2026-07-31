import { Suspense, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Home, UtensilsCrossed, Dumbbell, HeartPulse, Plus, Loader2 } from 'lucide-react'
import ActionHub from '../features/assistant/ActionHub'
import ActiveWorkoutBar from '../features/workouts/ActiveWorkoutBar'
import { useGoalAutoCheck } from '../features/assistant/goalAutoCheck'
import { useGarminSourceDetect } from '../features/settings/useGarminLink'
import { useChallengeScorePush } from '../features/challenges/useChallengeScorePush'

const tabs = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/nutrition', label: 'Diet', icon: UtensilsCrossed, end: false },
  { to: '/workouts', label: 'Train', icon: Dumbbell, end: false },
  { to: '/health', label: 'Health', icon: HeartPulse, end: false },
]

export default function AppShell() {
  const navigate = useNavigate()
  const [hubOpen, setHubOpen] = useState(false)
  // Data-driven goals: workout + gallon-of-water checks tick themselves.
  useGoalAutoCheck()
  // A connected Garmin answers "how do you track?" without asking.
  useGarminSourceDetect()
  // Publishes challenge scores off the same checklist the hook above ticks.
  useChallengeScorePush()

  return (
    <div className="h-dvh flex flex-col">
      <main className="flex-1 overflow-y-auto overscroll-contain safe-top">
        <div className="max-w-md mx-auto w-full">
          <Suspense
            fallback={
              <div className="flex justify-center py-20">
                <Loader2 size={28} className="animate-spin text-emerald-400" />
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </div>
      </main>
      {/* Sits directly above the tab bar, so a workout in progress is never more
          than one tap away and its clocks stay on screen wherever you are. */}
      <ActiveWorkoutBar />
      <nav className="border-t border-slate-800 bg-slate-950/90 backdrop-blur safe-bottom">
        <div className="max-w-md mx-auto w-full flex items-stretch justify-between px-2">
          {tabs.slice(0, 2).map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ${
                  isActive ? 'text-emerald-400' : 'text-slate-500'
                }`
              }
            >
              <Icon size={20} />
              <span className="whitespace-nowrap">{label}</span>
            </NavLink>
          ))}

          {/* Center "+" opens the universal Action Hub: type/speak a command, or tap
              a quick action (food, workout, weight, water, supplements). */}
          <div className="flex-1 flex justify-center">
            <button
              type="button"
              onClick={() => setHubOpen(true)}
              aria-label="Quick log"
              className="-mt-4 w-14 h-14 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center shadow-lg shadow-emerald-500/20 active:bg-emerald-400"
            >
              <Plus size={26} strokeWidth={2.5} />
            </button>
          </div>

          {tabs.slice(2).map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ${
                  isActive ? 'text-emerald-400' : 'text-slate-500'
                }`
              }
            >
              <Icon size={20} />
              <span className="whitespace-nowrap">{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      <ActionHub
        open={hubOpen}
        onClose={() => setHubOpen(false)}
        onNavigate={(to, state) => {
          setHubOpen(false)
          navigate(to, { state })
        }}
      />
    </div>
  )
}

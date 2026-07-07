import { NavLink, Outlet } from 'react-router-dom'
import { Home, UtensilsCrossed, Dumbbell, TrendingUp, Settings } from 'lucide-react'

const tabs = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/nutrition', label: 'Diary', icon: UtensilsCrossed, end: false },
  { to: '/workouts', label: 'Workouts', icon: Dumbbell, end: false },
  { to: '/progress', label: 'Progress', icon: TrendingUp, end: false },
  { to: '/settings', label: 'Settings', icon: Settings, end: false },
]

export default function AppShell() {
  return (
    <div className="h-dvh flex flex-col">
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-md mx-auto w-full">
          <Outlet />
        </div>
      </main>
      <nav className="border-t border-slate-800 bg-slate-950/90 backdrop-blur safe-bottom">
        <div className="max-w-md mx-auto w-full flex items-stretch justify-between px-2">
          {tabs.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-1 py-2 text-xs ${
                  isActive ? 'text-emerald-400' : 'text-slate-500'
                }`
              }
            >
              <Icon size={22} />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}

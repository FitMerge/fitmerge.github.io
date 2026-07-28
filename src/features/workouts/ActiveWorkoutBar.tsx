// The running workout, visible from anywhere in the app.
//
// Both clocks it shows are differences against a stored timestamp — the session's
// startedAt and the rest timer's deadline — so this component owns no elapsed
// state of its own. It only needs something to make it re-render once a second,
// which means a dropped or throttled tick can never make it lose time.
//
// It hides on /workouts, where the session screen already shows both.

import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Dumbbell, Timer } from 'lucide-react'
import { useWorkoutsStore } from '../../store/workouts'
import { formatElapsed } from './utils'

export default function ActiveWorkoutBar() {
  const activeSessionId = useWorkoutsStore((s) => s.activeSessionId)
  const sessions = useWorkoutsStore((s) => s.sessions)
  const rest = useWorkoutsStore((s) => s.restTimer)
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    const wake = () => setNow(Date.now())
    document.addEventListener('visibilitychange', wake)
    window.addEventListener('focus', wake)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', wake)
      window.removeEventListener('focus', wake)
    }
  }, [])

  const session = activeSessionId ? sessions.find((s) => s.id === activeSessionId) : undefined
  if (!session || pathname.startsWith('/workouts')) return null

  const restLeft = rest ? Math.max(0, Math.ceil((rest.endsAt - now) / 1000)) : null
  const resting = restLeft !== null
  const restDone = restLeft === 0

  return (
    <button
      type="button"
      onClick={() => navigate('/workouts')}
      className="w-full border-t border-slate-800 bg-slate-900 px-4 py-2 text-left active:bg-slate-800"
      aria-label={`Return to ${session.name}`}
    >
      <div className="mx-auto flex w-full max-w-md items-center gap-3">
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
            restDone ? 'bg-emerald-500/20 text-emerald-300' : 'bg-primary-500/20 text-primary-300'
          }`}
        >
          {resting ? <Timer size={16} /> : <Dumbbell size={16} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-semibold text-slate-100">{session.name}</span>
          <span className="block text-[11px] text-slate-400 tabular-nums">
            {formatElapsed(now - session.startedAt)}
            {resting && (
              <>
                {' · '}
                <span className={restDone ? 'text-emerald-300' : 'text-primary-300'}>
                  {restDone
                    ? 'rest complete'
                    : `rest ${String(Math.floor(restLeft / 60)).padStart(2, '0')}:${String(restLeft % 60).padStart(2, '0')}`}
                </span>
              </>
            )}
          </span>
        </span>
        <span className="shrink-0 text-[11px] font-medium text-primary-300">Resume</span>
      </div>
    </button>
  )
}

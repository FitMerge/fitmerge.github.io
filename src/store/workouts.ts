import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { uid } from '../lib/id'
import type { Routine, WorkoutSession } from '../types'

type WorkoutsState = {
  routines: Routine[]
  sessions: WorkoutSession[]
  activeSessionId?: string
  addRoutine: (routine: Omit<Routine, 'id'>) => void
  updateRoutine: (id: string, patch: Partial<Routine>) => void
  removeRoutine: (id: string) => void
  addSession: (session: Omit<WorkoutSession, 'id'>) => void
  updateSession: (id: string, patch: Partial<WorkoutSession>) => void
  removeSession: (id: string) => void
  setActiveSessionId: (id: string | undefined) => void
  /** Creates a session, marks it as the active in-progress session, and returns its id. */
  startSession: (session: Omit<WorkoutSession, 'id'>) => string
}

export const useWorkoutsStore = create<WorkoutsState>()(
  persist(
    (set, get) => ({
      routines: [],
      sessions: [],
      activeSessionId: undefined,
      addRoutine: (routine) => {
        set({ routines: [...get().routines, { ...routine, id: uid() }] })
      },
      updateRoutine: (id, patch) => {
        set({
          routines: get().routines.map((r) => (r.id === id ? { ...r, ...patch } : r)),
        })
      },
      removeRoutine: (id) => {
        set({ routines: get().routines.filter((r) => r.id !== id) })
      },
      addSession: (session) => {
        set({ sessions: [...get().sessions, { ...session, id: uid() }] })
      },
      updateSession: (id, patch) => {
        set({
          sessions: get().sessions.map((s) => (s.id === id ? { ...s, ...patch } : s)),
        })
      },
      removeSession: (id) => {
        set({ sessions: get().sessions.filter((s) => s.id !== id) })
      },
      setActiveSessionId: (id) => {
        set({ activeSessionId: id })
      },
      startSession: (session) => {
        const id = uid()
        set({ sessions: [...get().sessions, { ...session, id }], activeSessionId: id })
        return id
      },
    }),
    { name: 'fm-workouts' },
  ),
)

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { uid } from '../lib/id'
import type { Program, Routine, WorkoutSession } from '../types'

type WorkoutsState = {
  routines: Routine[]
  sessions: WorkoutSession[]
  programs: Program[]
  activeProgramId?: string
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
  addProgram: (program: Omit<Program, 'id' | 'createdAt' | 'completedDayIds'>) => string
  updateProgram: (id: string, patch: Partial<Program>) => void
  removeProgram: (id: string) => void
  setActiveProgram: (id: string | undefined) => void
  /** Marks the ProgramDay with this id complete in whichever program contains it. */
  completeProgramDay: (dayId: string) => void
}

export const useWorkoutsStore = create<WorkoutsState>()(
  persist(
    (set, get) => ({
      routines: [],
      sessions: [],
      programs: [],
      activeProgramId: undefined,
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
      addProgram: (program) => {
        const id = uid()
        set({
          programs: [...get().programs, { ...program, id, createdAt: Date.now(), completedDayIds: [] }],
          activeProgramId: id,
        })
        return id
      },
      updateProgram: (id, patch) => {
        set({ programs: get().programs.map((p) => (p.id === id ? { ...p, ...patch } : p)) })
      },
      removeProgram: (id) => {
        set({
          programs: get().programs.filter((p) => p.id !== id),
          activeProgramId: get().activeProgramId === id ? undefined : get().activeProgramId,
        })
      },
      setActiveProgram: (id) => {
        set({ activeProgramId: id })
      },
      completeProgramDay: (dayId) => {
        set({
          programs: get().programs.map((p) =>
            p.days.some((d) => d.id === dayId) && !p.completedDayIds.includes(dayId)
              ? { ...p, completedDayIds: [...p.completedDayIds, dayId] }
              : p,
          ),
        })
      },
    }),
    { name: 'fm-workouts' },
  ),
)

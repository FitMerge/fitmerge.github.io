import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { uid } from '../lib/id'
import type { ProgramTemplate } from '../data/programs'
import type { GarminRecord, Program, ProgramDay, Routine, WorkoutSession } from '../types'

type WorkoutsState = {
  routines: Routine[]
  sessions: WorkoutSession[]
  programs: Program[]
  /** Personal records as Garmin computes them. Written by the sync job, read-only here. */
  garminRecords: GarminRecord[]
  activeProgramId?: string
  activeSessionId?: string
  addRoutine: (routine: Omit<Routine, 'id'>) => void
  updateRoutine: (id: string, patch: Partial<Routine>) => void
  removeRoutine: (id: string) => void
  addSession: (session: Omit<WorkoutSession, 'id'>) => void
  /** Append many imported sessions in a SINGLE persisted write, skipping ones that
   * duplicate an existing imported session (same date + name). Avoids the O(n²)
   * per-session localStorage writes that froze large Garmin imports. */
  addImportedSessions: (sessions: Omit<WorkoutSession, 'id'>[]) => number
  updateSession: (id: string, patch: Partial<WorkoutSession>) => void
  removeSession: (id: string) => void
  setActiveSessionId: (id: string | undefined) => void
  /** Creates a session, marks it as the active in-progress session, and returns its id. */
  startSession: (session: Omit<WorkoutSession, 'id'>) => string
  addProgram: (program: Omit<Program, 'id' | 'createdAt' | 'completedDayIds'>) => string
  /** Installs a ready-made program template: creates its routines and a program that
   * schedules them, in a single write. Returns the new program's id. */
  installProgramTemplate: (template: ProgramTemplate) => string
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
      garminRecords: [],
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
      addImportedSessions: (incoming) => {
        const existing = get().sessions
        // Key on date+name+duration+kcal so two distinct activities on the same day
        // (e.g. a morning and evening walk) are both kept, while re-importing the
        // same file stays idempotent.
        const key = (s: Pick<WorkoutSession, 'date' | 'name' | 'durationMin' | 'kcal'>) =>
          `${s.date}::${s.name}::${s.durationMin ?? ''}::${s.kcal ?? ''}`
        const seen = new Set(existing.filter((s) => s.imported).map(key))
        const added: WorkoutSession[] = []
        for (const s of incoming) {
          const k = key(s)
          if (seen.has(k)) continue
          seen.add(k)
          added.push({ ...s, id: uid() })
        }
        if (added.length > 0) set({ sessions: [...existing, ...added] })
        return added.length
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
      installProgramTemplate: (template) => {
        // Create a fresh Routine per template routine, tracking key → new id.
        const routineIdByKey = new Map<string, string>()
        const newRoutines: Routine[] = template.routines.map((tr) => {
          const id = uid()
          routineIdByKey.set(tr.key, id)
          return {
            id,
            name: tr.name,
            items: tr.items,
            scheduleDays: tr.scheduleDays,
          }
        })
        const programId = uid()
        const days: ProgramDay[] = template.schedule.map((d) => ({
          id: uid(),
          week: d.week,
          name: d.name,
          routineId: routineIdByKey.get(d.routineKey) ?? '',
        }))
        const program: Program = {
          id: programId,
          name: template.name,
          createdAt: Date.now(),
          days,
          completedDayIds: [],
        }
        set({
          routines: [...get().routines, ...newRoutines],
          programs: [...get().programs, program],
          activeProgramId: programId,
        })
        return programId
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

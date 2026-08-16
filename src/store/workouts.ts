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
  /**
   * The rest countdown for the in-progress session, held as an absolute DEADLINE
   * rather than a remaining count.
   *
   * It lives in the store, not in ActiveSession, because leaving the workout page
   * unmounted the component and took the timer with it — the rest between sets is
   * exactly when you go and look at something else. And it is a deadline because a
   * counter that decrements once a second is only correct while something is
   * decrementing it: a backgrounded tab (or a locked phone) suspends timers, so a
   * count would resume where it left off while the clock had moved on.
   *
   * Local to the device, like activeSessionId — never synced.
   */
  restTimer?: { endsAt: number; totalSeconds: number }
  startRestTimer: (seconds: number) => void
  /** Extend a running timer, keeping the bar's proportions honest. */
  addRestTime: (seconds: number) => void
  clearRestTimer: () => void
  addRoutine: (routine: Omit<Routine, 'id'>) => void
  updateRoutine: (id: string, patch: Partial<Routine>) => void
  removeRoutine: (id: string) => void
  addSession: (session: Omit<WorkoutSession, 'id'>) => void
  /** Log a completed activity done outside a tracked workout — a run, a yoga class,
   * a hike. Creates a FINISHED session with no strength sets, so it flows into the
   * cardio views, the activity feed and coaching, and its calories feed the day's
   * budget — unlike the calorie-only manual exercise entry. */
  logActivity: (input: {
    name: string
    date: string
    durationMin?: number
    kcal?: number
    distanceKm?: number
  }) => void
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
      restTimer: undefined,
      startRestTimer: (seconds) => {
        set({ restTimer: { endsAt: Date.now() + seconds * 1000, totalSeconds: seconds } })
      },
      addRestTime: (seconds) => {
        const cur = get().restTimer
        if (!cur) return
        // From NOW when the timer has already run out, so "+15s" on a finished rest
        // gives you fifteen seconds rather than a deadline that is still in the past.
        const from = Math.max(cur.endsAt, Date.now())
        set({ restTimer: { endsAt: from + seconds * 1000, totalSeconds: cur.totalSeconds + seconds } })
      },
      clearRestTimer: () => {
        set({ restTimer: undefined })
      },
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
      logActivity: (input) => {
        // Anchor to local noon on the chosen day so a past-dated activity sorts
        // sensibly and a timezone shift can't nudge it onto the wrong date.
        const [y, m, d] = input.date.split('-').map(Number)
        const startedAt = new Date(y, (m ?? 1) - 1, d ?? 1, 12).getTime()
        const durationMin = input.durationMin && input.durationMin > 0 ? input.durationMin : undefined
        const session: WorkoutSession = {
          id: uid(),
          name: input.name,
          date: input.date,
          startedAt,
          finishedAt: startedAt + (durationMin ?? 0) * 60000,
          entries: [],
        }
        if (durationMin !== undefined) session.durationMin = durationMin
        if (input.kcal && input.kcal > 0) session.kcal = Math.round(input.kcal)
        if (input.distanceKm && input.distanceKm > 0) session.distanceKm = input.distanceKm
        set({ sessions: [...get().sessions, session] })
      },
      addImportedSessions: (incoming) => {
        const existing = get().sessions
        // Two keys per session, strongest first — this must stay in step with
        // `_session_keys` in scripts/garmin-sync.py.
        //
        // Garmin's activity id is exact and survives Garmin revising a duration. The
        // date+name+duration+kcal fallback covers sessions stored before that id was
        // captured, and keeps two activities on one day (a morning and an evening
        // walk) distinct.
        //
        // The fallback rounds both numbers first: the sync stores rounded values
        // while a file import keeps the raw ones, so comparing them unrounded made
        // one activity produce two different keys — importing it twice instead of
        // recognising it.
        const keysFor = (s: Partial<WorkoutSession>): string[] => {
          const keys: string[] = []
          if (s.garminActivityId) keys.push(`gid::${s.garminActivityId}`)
          const duration = typeof s.durationMin === 'number' ? s.durationMin.toFixed(1) : ''
          const kcal = typeof s.kcal === 'number' ? String(Math.round(s.kcal)) : ''
          keys.push(`${s.date}::${s.name}::${duration}::${kcal}`)
          return keys
        }
        const seen = new Set(existing.filter((s) => s.imported).flatMap(keysFor))
        const added: WorkoutSession[] = []
        for (const s of incoming) {
          const keys = keysFor(s)
          if (keys.some((k) => seen.has(k))) continue
          for (const k of keys) seen.add(k)
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
        // A rest timer belongs to the workout that started it; finishing or
        // discarding one must not leave its countdown running over the next.
        set({ activeSessionId: id, restTimer: undefined })
      },
      startSession: (session) => {
        const id = uid()
        set({ sessions: [...get().sessions, { ...session, id }], activeSessionId: id, restTimer: undefined })
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

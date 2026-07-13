import type { RoutineItem } from '../types'

/** A routine within a program template. `key` links schedule days to this routine
 * (mapped to a freshly-created Routine id on install). */
export type ProgramTemplateRoutine = {
  key: string
  name: string
  items: RoutineItem[]
  scheduleDays?: number[]
}

/** One scheduled day in a program template, referencing a routine by `routineKey`. */
export type ProgramTemplateDay = {
  week: number
  name: string
  routineKey: string
}

/** A ready-made, installable training program shown in the program library. */
export type ProgramTemplate = {
  id: string
  name: string
  goal: string
  level: 'Beginner' | 'Intermediate' | 'Advanced'
  daysPerWeek: number
  weeks: number
  description: string
  routines: ProgramTemplateRoutine[]
  schedule: ProgramTemplateDay[]
}

// Weekday indices: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat.

export const PROGRAM_TEMPLATES: ProgramTemplate[] = [
  {
    id: 'ppl-6day',
    name: 'Push / Pull / Legs',
    goal: 'Hypertrophy',
    level: 'Intermediate',
    daysPerWeek: 6,
    weeks: 4,
    description:
      'The classic six-day split: push, pull and legs each trained twice a week for maximum volume. Ideal for lifters ready to step up their training frequency.',
    routines: [
      {
        key: 'push',
        name: 'Push',
        scheduleDays: [1, 4],
        items: [
          { exerciseId: 'bench-press', targetSets: 4, targetReps: 8, restSec: 120 },
          { exerciseId: 'overhead-press', targetSets: 3, targetReps: 10, restSec: 120 },
          { exerciseId: 'incline-db-press', targetSets: 3, targetReps: 10, restSec: 90 },
          { exerciseId: 'lateral-raise', targetSets: 3, targetReps: 15, restSec: 60 },
          { exerciseId: 'cable-fly', targetSets: 3, targetReps: 12, restSec: 60 },
          { exerciseId: 'triceps-pushdown', targetSets: 3, targetReps: 12, restSec: 60 },
        ],
      },
      {
        key: 'pull',
        name: 'Pull',
        scheduleDays: [2, 5],
        items: [
          { exerciseId: 'barbell-row', targetSets: 4, targetReps: 8, restSec: 120 },
          { exerciseId: 'pull-up', targetSets: 3, targetReps: 8, restSec: 90 },
          { exerciseId: 'lat-pulldown', targetSets: 3, targetReps: 12, restSec: 90 },
          { exerciseId: 'seated-cable-row', targetSets: 3, targetReps: 12, restSec: 90 },
          { exerciseId: 'face-pull', targetSets: 3, targetReps: 15, restSec: 60 },
          { exerciseId: 'barbell-curl', targetSets: 3, targetReps: 12, restSec: 60 },
        ],
      },
      {
        key: 'legs',
        name: 'Legs',
        scheduleDays: [3, 6],
        items: [
          { exerciseId: 'squat', targetSets: 4, targetReps: 8, restSec: 150 },
          { exerciseId: 'romanian-deadlift', targetSets: 3, targetReps: 10, restSec: 120 },
          { exerciseId: 'leg-press', targetSets: 3, targetReps: 12, restSec: 90 },
          { exerciseId: 'leg-curl', targetSets: 3, targetReps: 12, restSec: 60 },
          { exerciseId: 'calf-raise', targetSets: 4, targetReps: 15, restSec: 60 },
          { exerciseId: 'hanging-leg-raise', targetSets: 3, targetReps: 12, restSec: 60 },
        ],
      },
    ],
    schedule: [
      { week: 1, name: 'Push A', routineKey: 'push' },
      { week: 1, name: 'Pull A', routineKey: 'pull' },
      { week: 1, name: 'Legs A', routineKey: 'legs' },
      { week: 1, name: 'Push B', routineKey: 'push' },
      { week: 1, name: 'Pull B', routineKey: 'pull' },
      { week: 1, name: 'Legs B', routineKey: 'legs' },
    ],
  },
  {
    id: 'full-body-3x-beginner',
    name: 'Full Body 3× (Beginner)',
    goal: 'General strength',
    level: 'Beginner',
    daysPerWeek: 3,
    weeks: 8,
    description:
      'One balanced full-body session repeated three times a week on Monday, Wednesday and Friday. The simplest way to build a lifting habit and cover every major muscle.',
    routines: [
      {
        key: 'full-body',
        name: 'Full Body',
        scheduleDays: [1, 3, 5],
        items: [
          { exerciseId: 'squat', targetSets: 3, targetReps: 8, restSec: 120 },
          { exerciseId: 'bench-press', targetSets: 3, targetReps: 8, restSec: 120 },
          { exerciseId: 'barbell-row', targetSets: 3, targetReps: 10, restSec: 120 },
          { exerciseId: 'overhead-press', targetSets: 3, targetReps: 10, restSec: 90 },
          { exerciseId: 'romanian-deadlift', targetSets: 3, targetReps: 10, restSec: 120 },
          { exerciseId: 'plank', targetSets: 3, targetReps: 45, restSec: 60, note: 'Hold for ~45 seconds.' },
        ],
      },
    ],
    schedule: [
      { week: 1, name: 'Full Body — Mon', routineKey: 'full-body' },
      { week: 1, name: 'Full Body — Wed', routineKey: 'full-body' },
      { week: 1, name: 'Full Body — Fri', routineKey: 'full-body' },
    ],
  },
  {
    id: 'strength-5x5',
    name: '5×5 Strength',
    goal: 'Strength',
    level: 'Intermediate',
    daysPerWeek: 3,
    weeks: 12,
    description:
      'A proven linear-progression strength program built on two alternating full-body workouts of heavy fives. Add weight every session and let long rests do the work.',
    routines: [
      {
        key: 'workout-a',
        name: 'Workout A',
        scheduleDays: [1, 5],
        items: [
          { exerciseId: 'squat', targetSets: 5, targetReps: 5, restSec: 180 },
          { exerciseId: 'bench-press', targetSets: 5, targetReps: 5, restSec: 180 },
          { exerciseId: 'barbell-row', targetSets: 5, targetReps: 5, restSec: 180 },
        ],
      },
      {
        key: 'workout-b',
        name: 'Workout B',
        scheduleDays: [3],
        items: [
          { exerciseId: 'squat', targetSets: 5, targetReps: 5, restSec: 180 },
          { exerciseId: 'overhead-press', targetSets: 5, targetReps: 5, restSec: 180 },
          { exerciseId: 'deadlift', targetSets: 1, targetReps: 5, restSec: 180, note: 'One heavy work set of five.' },
        ],
      },
    ],
    schedule: [
      { week: 1, name: 'Workout A', routineKey: 'workout-a' },
      { week: 1, name: 'Workout B', routineKey: 'workout-b' },
      { week: 1, name: 'Workout A', routineKey: 'workout-a' },
      { week: 2, name: 'Workout B', routineKey: 'workout-b' },
      { week: 2, name: 'Workout A', routineKey: 'workout-a' },
      { week: 2, name: 'Workout B', routineKey: 'workout-b' },
    ],
  },
  {
    id: 'dumbbell-home-beginner',
    name: 'Dumbbell Home (Beginner)',
    goal: 'General fitness',
    level: 'Beginner',
    daysPerWeek: 3,
    weeks: 8,
    description:
      'A full-body plan you can run at home with just a pair of dumbbells. Three sessions a week to build strength and muscle without a gym.',
    routines: [
      {
        key: 'dumbbell-full-body',
        name: 'Dumbbell Full Body',
        scheduleDays: [1, 3, 5],
        items: [
          { exerciseId: 'bulgarian-split-squat', targetSets: 3, targetReps: 10, restSec: 90, note: 'Per leg.' },
          { exerciseId: 'incline-db-press', targetSets: 3, targetReps: 12, restSec: 90 },
          { exerciseId: 'single-arm-db-row', targetSets: 3, targetReps: 12, restSec: 90, note: 'Per arm.' },
          { exerciseId: 'dumbbell-curl', targetSets: 3, targetReps: 12, restSec: 60 },
          { exerciseId: 'overhead-triceps-extension', targetSets: 3, targetReps: 12, restSec: 60 },
          { exerciseId: 'plank', targetSets: 3, targetReps: 45, restSec: 60, note: 'Hold for ~45 seconds.' },
        ],
      },
    ],
    schedule: [
      { week: 1, name: 'Dumbbell Full Body — Mon', routineKey: 'dumbbell-full-body' },
      { week: 1, name: 'Dumbbell Full Body — Wed', routineKey: 'dumbbell-full-body' },
      { week: 1, name: 'Dumbbell Full Body — Fri', routineKey: 'dumbbell-full-body' },
    ],
  },
  {
    id: 'glute-core-beginner',
    name: 'Glute & Core (Beginner)',
    goal: 'Glutes & core',
    level: 'Beginner',
    daysPerWeek: 4,
    weeks: 6,
    description:
      'A four-day plan that alternates glute-focused lower-body work with dedicated core sessions. Build a stronger posterior chain and a solid midsection.',
    routines: [
      {
        key: 'lower',
        name: 'Lower (Glutes)',
        scheduleDays: [1, 4],
        items: [
          { exerciseId: 'hip-thrust', targetSets: 4, targetReps: 12, restSec: 90 },
          { exerciseId: 'romanian-deadlift', targetSets: 3, targetReps: 10, restSec: 120 },
          { exerciseId: 'bulgarian-split-squat', targetSets: 3, targetReps: 10, restSec: 90, note: 'Per leg.' },
          { exerciseId: 'glute-bridge', targetSets: 3, targetReps: 15, restSec: 60 },
        ],
      },
      {
        key: 'core-glutes',
        name: 'Core & Glutes',
        scheduleDays: [2, 5],
        items: [
          { exerciseId: 'cable-kickback', targetSets: 3, targetReps: 15, restSec: 60, note: 'Per leg.' },
          { exerciseId: 'plank', targetSets: 3, targetReps: 45, restSec: 60, note: 'Hold for ~45 seconds.' },
          { exerciseId: 'russian-twist', targetSets: 3, targetReps: 20, restSec: 45 },
          { exerciseId: 'hanging-leg-raise', targetSets: 3, targetReps: 12, restSec: 60 },
        ],
      },
    ],
    schedule: [
      { week: 1, name: 'Lower A', routineKey: 'lower' },
      { week: 1, name: 'Core & Glutes A', routineKey: 'core-glutes' },
      { week: 1, name: 'Lower B', routineKey: 'lower' },
      { week: 1, name: 'Core & Glutes B', routineKey: 'core-glutes' },
    ],
  },
]

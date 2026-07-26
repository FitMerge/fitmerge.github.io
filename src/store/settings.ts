import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Goals, Profile, Units } from '../types'

/** What the AI coach needs that raw data can't infer — captured once, editable. */
export type CoachProfile = {
  primaryGoal: 'build-muscle' | 'lose-fat' | 'strength' | 'endurance' | 'general-health'
  experience: 'beginner' | 'intermediate' | 'advanced'
  daysPerWeek: number
  sessionMinutes: number
  /** Free text: emphasis (e.g. "chest & arms"), preferences. */
  focus?: string
  /** Injuries / limitations to train around. */
  constraints?: string
  /** Dietary notes / restrictions. */
  dietNotes?: string
}

/** Where a user's wearable data comes from — chosen during onboarding so the app
 * can shape itself instead of showing everyone the Garmin-flavoured setup.
 * 'manual' means no wearable: health metrics are typed in, not synced. */
export type TrackingSource = 'garmin' | 'apple' | 'other' | 'manual'

type SettingsState = {
  goals: Goals
  units: Units
  profile: Profile
  geminiApiKey: string
  usdaApiKey: string
  waterGoalMl: number
  /** Target body weight in kg (canonical metric storage); undefined = no goal set. */
  goalWeightKg?: number
  onboarded: boolean
  /** GitHub fine-grained token used to trigger the cloud Garmin-pull workflow.
   * Synced across the user's own devices via their private per-user Firestore doc
   * (see storeAdapters KEY_FIELDS), guarded so an empty value never wipes it. */
  githubToken: string
  /** "owner/repo" hosting the garmin-pull workflow. Synced across devices. */
  githubRepo: string
  /** Equipment the user owns, used to filter exercise-swap suggestions. undefined
   * = no preference (everything available); Bodyweight is always available. */
  availableEquipment?: string[]
  /** Play a ding + buzz when the rest timer hits zero. */
  restTimerSound: boolean
  /** Goals/constraints for the AI coach; undefined until the user fills it in. */
  coachProfile?: CoachProfile
  /** Epoch ms of the last successful manual Garmin pull trigger. */
  lastGarminPullAt?: number
  /** Which wearable (if any) feeds health data. undefined = never asked. */
  trackingSource?: TrackingSource
  setGoals: (goals: Goals) => void
  setUnits: (units: Units) => void
  setProfile: (patch: Partial<Profile>) => void
  setGeminiApiKey: (key: string) => void
  setUsdaApiKey: (key: string) => void
  setWaterGoalMl: (ml: number) => void
  setGoalWeightKg: (kg: number | undefined) => void
  setOnboarded: (v: boolean) => void
  setGithubToken: (token: string) => void
  setGithubRepo: (repo: string) => void
  setAvailableEquipment: (list: string[]) => void
  setRestTimerSound: (on: boolean) => void
  setCoachProfile: (profile: CoachProfile) => void
  setLastGarminPullAt: (ts: number) => void
  setTrackingSource: (source: TrackingSource) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      goals: { calories: 2200, protein: 150, carbs: 220, fat: 70 },
      units: 'imperial',
      profile: { sex: 'male', activity: 'moderate' },
      geminiApiKey: '',
      usdaApiKey: '',
      waterGoalMl: 2000,
      onboarded: false,
      githubToken: '',
      githubRepo: '',
      restTimerSound: true,
      setGoals: (goals) => set({ goals }),
      setUnits: (units) => set({ units }),
      setProfile: (patch) => set({ profile: { ...get().profile, ...patch } }),
      setGeminiApiKey: (key) => set({ geminiApiKey: key }),
      setUsdaApiKey: (key) => set({ usdaApiKey: key }),
      setWaterGoalMl: (ml) => set({ waterGoalMl: ml }),
      setGoalWeightKg: (kg) => set({ goalWeightKg: kg }),
      setOnboarded: (v) => set({ onboarded: v }),
      setGithubToken: (token) => set({ githubToken: token }),
      setGithubRepo: (repo) => set({ githubRepo: repo }),
      setAvailableEquipment: (list) => set({ availableEquipment: list }),
      setRestTimerSound: (on) => set({ restTimerSound: on }),
      setCoachProfile: (profile) => set({ coachProfile: profile }),
      setLastGarminPullAt: (ts) => set({ lastGarminPullAt: ts }),
      setTrackingSource: (source) => set({ trackingSource: source }),
    }),
    { name: 'fm-settings' },
  ),
)

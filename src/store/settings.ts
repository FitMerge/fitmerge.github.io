import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Goals, Profile, Units } from '../types'

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
   * Device-local only — deliberately NOT synced to the cloud (see storeAdapters). */
  githubToken: string
  /** "owner/repo" hosting the garmin-pull workflow. Device-local. */
  githubRepo: string
  /** Epoch ms of the last successful manual Garmin pull trigger. */
  lastGarminPullAt?: number
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
  setLastGarminPullAt: (ts: number) => void
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
      setLastGarminPullAt: (ts) => set({ lastGarminPullAt: ts }),
    }),
    { name: 'fm-settings' },
  ),
)

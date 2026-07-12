import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Goals, Profile, Units } from '../types'

type SettingsState = {
  goals: Goals
  units: Units
  profile: Profile
  geminiApiKey: string
  waterGoalMl: number
  setGoals: (goals: Goals) => void
  setUnits: (units: Units) => void
  setProfile: (patch: Partial<Profile>) => void
  setGeminiApiKey: (key: string) => void
  setWaterGoalMl: (ml: number) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      goals: { calories: 2200, protein: 150, carbs: 220, fat: 70 },
      units: 'metric',
      profile: { sex: 'male', activity: 'moderate' },
      geminiApiKey: '',
      waterGoalMl: 2000,
      setGoals: (goals) => set({ goals }),
      setUnits: (units) => set({ units }),
      setProfile: (patch) => set({ profile: { ...get().profile, ...patch } }),
      setGeminiApiKey: (key) => set({ geminiApiKey: key }),
      setWaterGoalMl: (ml) => set({ waterGoalMl: ml }),
    }),
    { name: 'fm-settings' },
  ),
)

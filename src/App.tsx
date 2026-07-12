import { Routes, Route } from 'react-router-dom'
import AppShell from './components/AppShell'
import Dashboard from './features/dashboard/Dashboard'
import Diary from './features/nutrition/Diary'
import Workouts from './features/workouts/Workouts'
import Progress from './features/progress/Progress'
import Settings from './features/settings/Settings'
import OnboardingWizard from './features/onboarding/OnboardingWizard'
import { useSettingsStore } from './store/settings'

export default function App() {
  const onboarded = useSettingsStore((s) => s.onboarded)

  return (
    <>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Dashboard />} />
          <Route path="nutrition" element={<Diary />} />
          <Route path="workouts" element={<Workouts />} />
          <Route path="progress" element={<Progress />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
      {!onboarded && <OnboardingWizard />}
    </>
  )
}

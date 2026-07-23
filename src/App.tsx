import { lazy } from 'react'
import { Routes, Route } from 'react-router-dom'
import AppShell from './components/AppShell'

// Route-level code splitting: heavy dependencies (Recharts on Progress and the
// workout progression sheet) load on demand instead of bloating first paint.
const Dashboard = lazy(() => import('./features/dashboard/Dashboard'))
const Diary = lazy(() => import('./features/nutrition/Diary'))
const Workouts = lazy(() => import('./features/workouts/Workouts'))
const Health = lazy(() => import('./features/health/Health'))
const Progress = lazy(() => import('./features/progress/Progress'))
const Settings = lazy(() => import('./features/settings/Settings'))
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
          <Route path="health" element={<Health />} />
          <Route path="progress" element={<Progress />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
      {!onboarded && <OnboardingWizard />}
    </>
  )
}

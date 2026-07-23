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
// Temporary design-preview routes for the home-screen overhaul (not linked in nav).
const HomeBriefing = lazy(() => import('./features/dashboard/home/HomeBriefing'))
const HomeGlance = lazy(() => import('./features/dashboard/home/HomeGlance'))
const HomeFeed = lazy(() => import('./features/dashboard/home/HomeFeed'))
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
          <Route path="home-preview/a" element={<HomeBriefing />} />
          <Route path="home-preview/b" element={<HomeGlance />} />
          <Route path="home-preview/c" element={<HomeFeed />} />
        </Route>
      </Routes>
      {!onboarded && <OnboardingWizard />}
    </>
  )
}

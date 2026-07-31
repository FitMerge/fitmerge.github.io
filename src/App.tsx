import { lazy } from 'react'
import { Routes, Route } from 'react-router-dom'
import AppShell from './components/AppShell'

// Route-level code splitting: heavy dependencies (Recharts on Progress and the
// workout progression sheet) load on demand instead of bloating first paint.
const Dashboard = lazy(() => import('./features/dashboard/Dashboard'))
const Diary = lazy(() => import('./features/nutrition/Diary'))
const Workouts = lazy(() => import('./features/workouts/Workouts'))
const Health = lazy(() => import('./features/health/Health'))
const Settings = lazy(() => import('./features/settings/Settings'))
const Challenges = lazy(() => import('./features/challenges/Challenges'))
const ChallengeDetail = lazy(() => import('./features/challenges/ChallengeDetail'))
import OnboardingWizard from './features/onboarding/OnboardingWizard'
import { useSettingsStore } from './store/settings'
import { useAuth } from './auth/AuthProvider'

export default function App() {
  const onboarded = useSettingsStore((s) => s.onboarded)
  const { authResolved, status, syncState } = useAuth()

  // A returning user signing in on a new device starts with empty local settings,
  // so `onboarded` is false until their cloud settings land. Waiting for auth and
  // the first reconcile keeps the wizard from flashing over an existing account.
  const cloudSettling = !authResolved || status === 'signing-in' || (status === 'signed-in' && syncState === 'syncing')

  return (
    <>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Dashboard />} />
          <Route path="nutrition" element={<Diary />} />
          <Route path="workouts" element={<Workouts />} />
          <Route path="health" element={<Health />} />
          <Route path="settings" element={<Settings />} />
          <Route path="challenges" element={<Challenges />} />
          {/* Invite links land here: same page, join sheet already open. */}
          <Route path="challenges/join/:code" element={<Challenges />} />
          <Route path="challenges/:code" element={<ChallengeDetail />} />
        </Route>
      </Routes>
      {!onboarded && !cloudSettling && <OnboardingWizard />}
    </>
  )
}

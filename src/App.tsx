import { Routes, Route } from 'react-router-dom'
import AppShell from './components/AppShell'
import Dashboard from './features/dashboard/Dashboard'
import Diary from './features/nutrition/Diary'
import Workouts from './features/workouts/Workouts'
import Progress from './features/progress/Progress'
import Settings from './features/settings/Settings'

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Dashboard />} />
        <Route path="nutrition" element={<Diary />} />
        <Route path="workouts" element={<Workouts />} />
        <Route path="progress" element={<Progress />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  )
}

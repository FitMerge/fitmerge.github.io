import ProfileSection from './ProfileSection'
import UnitsSection from './UnitsSection'
import GoalsSection from './GoalsSection'
import AiSection from './AiSection'
import DataSection from './DataSection'
import HealthConnectSection from './HealthConnectSection'
import AboutSection from './AboutSection'

export default function Settings() {
  return (
    <div className="p-4 pb-24 space-y-4">
      <header>
        <h1 className="text-xl font-bold text-slate-100">Settings</h1>
        <p className="text-sm text-slate-400">Manage your profile, goals, and preferences.</p>
      </header>

      <ProfileSection />
      <UnitsSection />
      <GoalsSection />
      <AiSection />
      <DataSection />
      <HealthConnectSection />
      <AboutSection />
    </div>
  )
}

import SyncSection from './SyncSection'
import ProfileSection from './ProfileSection'
import UnitsSection from './UnitsSection'
import GoalsSection from './GoalsSection'
import ChallengesSection from './ChallengesSection'
import EquipmentSection from './EquipmentSection'
import AiSection from './AiSection'
import FoodSearchSection from './FoodSearchSection'
import DataSection from './DataSection'
import HealthConnectSection from './HealthConnectSection'
import GarminConnectSection from './GarminConnectSection'
import GarminPullSection from './GarminPullSection'
import AboutSection from './AboutSection'

export default function Settings() {
  return (
    <div className="p-4 pb-24 space-y-4">
      <header>
        <h1 className="text-xl font-bold text-slate-100">Settings</h1>
        <p className="text-sm text-slate-400">Manage your profile, goals, and preferences.</p>
      </header>

      <SyncSection />
      <ProfileSection />
      <UnitsSection />
      <GoalsSection />
      <ChallengesSection />
      <EquipmentSection />
      <AiSection />
      <FoodSearchSection />
      <DataSection />
      <HealthConnectSection />
      <GarminConnectSection />
      <GarminPullSection />
      <AboutSection />
    </div>
  )
}

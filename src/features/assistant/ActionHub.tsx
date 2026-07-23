import { useState } from 'react'
import { ChevronLeft, Droplets, Dumbbell, Pill, Scale, UtensilsCrossed } from 'lucide-react'
import Sheet from '../../components/Sheet'
import Button from '../../components/Button'
import LogWeightSheet from '../progress/LogWeightSheet'
import SupplementList from './SupplementList'
import CommandBar from './CommandBar'
import { useNutritionStore } from '../../store/nutrition'
import { useWorkoutsStore } from '../../store/workouts'
import { useSettingsStore } from '../../store/settings'
import { todayISO } from '../../lib/date'
import { mlToFloz, waterUnit } from '../../lib/units'

type Screen = 'menu' | 'weight' | 'water' | 'supplement' | 'workout'

type ActionHubProps = {
  open: boolean
  onClose: () => void
  onNavigate: (to: string, state: unknown) => void
}

const TITLES: Record<Screen, string> = {
  menu: 'Quick log',
  weight: 'Log weight',
  water: 'Log water',
  supplement: 'Supplements & habits',
  workout: 'Start a workout',
}

export default function ActionHub({ open, onClose, onNavigate }: ActionHubProps) {
  const [screen, setScreen] = useState<Screen>('menu')

  function close() {
    onClose()
    // Reset to the menu after the close animation so it reopens on the hub.
    setTimeout(() => setScreen('menu'), 250)
  }

  return (
    <Sheet open={open} onClose={close} title={TITLES[screen]}>
      {screen !== 'menu' && (
        <button
          type="button"
          onClick={() => setScreen('menu')}
          className="mb-3 -mt-1 flex items-center gap-1 text-sm text-slate-400 active:text-slate-200"
        >
          <ChevronLeft size={16} /> Back
        </button>
      )}

      {screen === 'menu' && (
        <div className="space-y-4">
          <CommandBar onNavigate={(to, state) => onNavigate(to, state)} onDone={close} />

          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Quick actions</p>
            <div className="grid grid-cols-3 gap-2">
              <Tile icon={UtensilsCrossed} label="Food" onClick={() => onNavigate('/nutrition', { openAdd: true })} />
              <Tile icon={Dumbbell} label="Workout" onClick={() => setScreen('workout')} />
              <Tile icon={Scale} label="Weight" onClick={() => setScreen('weight')} />
              <Tile icon={Droplets} label="Water" onClick={() => setScreen('water')} />
              <Tile icon={Pill} label="Supplements" onClick={() => setScreen('supplement')} />
            </div>
          </div>
        </div>
      )}

      {screen === 'weight' && <LogWeightSheet onClose={close} />}
      {screen === 'water' && <WaterScreen />}
      {screen === 'supplement' && <SupplementList />}
      {screen === 'workout' && <WorkoutScreen onPick={(id) => onNavigate('/workouts', { startRoutineId: id })} onClose={close} />}
    </Sheet>
  )
}

function Tile({ icon: Icon, label, onClick }: { icon: typeof Scale; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-xl bg-slate-800/70 text-slate-200 active:bg-slate-800"
    >
      <Icon size={22} className="text-primary-400" />
      <span className="text-xs">{label}</span>
    </button>
  )
}

function WaterScreen() {
  const units = useSettingsStore((s) => s.units)
  const water = useNutritionStore((s) => s.water)
  const addWater = useNutritionStore((s) => s.addWater)
  const goal = useSettingsStore((s) => s.waterGoalMl)
  const today = todayISO()
  const total = water[today] ?? 0
  const fmt = (ml: number) => (units === 'imperial' ? `${Math.round(mlToFloz(ml))} ${waterUnit(units)}` : `${ml} ml`)

  return (
    <div className="space-y-4">
      <div className="text-center">
        <p className="text-3xl font-bold text-slate-100">{fmt(total)}</p>
        <p className="text-xs text-slate-500">of {fmt(goal)} today</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[250, 500, 750].map((ml) => (
          <button
            key={ml}
            type="button"
            onClick={() => addWater(today, ml)}
            className="rounded-xl bg-slate-800 py-3 text-sm font-medium text-slate-200 active:bg-slate-700"
          >
            +{fmt(ml)}
          </button>
        ))}
      </div>
      {total > 0 && (
        <button type="button" onClick={() => addWater(today, -Math.min(250, total))} className="w-full text-xs text-slate-500">
          Undo last cup
        </button>
      )}
    </div>
  )
}

function WorkoutScreen({ onPick, onClose }: { onPick: (id: string) => void; onClose: () => void }) {
  const routines = useWorkoutsStore((s) => s.routines)

  if (routines.length === 0) {
    return (
      <div className="space-y-3 text-center">
        <p className="text-sm text-slate-400">You don't have any routines yet.</p>
        <Button variant="primary" full onClick={onClose}>
          Close
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {routines.map((r) => (
        <button
          key={r.id}
          type="button"
          onClick={() => onPick(r.id)}
          className="flex w-full items-center justify-between rounded-xl bg-slate-800 px-4 py-3 text-left active:bg-slate-700"
        >
          <span>
            <span className="block text-sm font-medium text-slate-100">{r.name}</span>
            <span className="block text-xs text-slate-500">{r.items.length} exercises</span>
          </span>
          <Dumbbell size={18} className="text-primary-400" />
        </button>
      ))}
    </div>
  )
}

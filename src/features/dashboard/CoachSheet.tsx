import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, Sparkles, Dumbbell, Apple, Target, Send } from 'lucide-react'
import Sheet from '../../components/Sheet'
import Button from '../../components/Button'
import { useSettingsStore, type CoachProfile } from '../../store/settings'
import { useNutritionStore } from '../../store/nutrition'
import { useWorkoutsStore } from '../../store/workouts'
import { useHealthStore } from '../../store/health'
import { useBodyStore } from '../../store/body'
import { useSupplementStore } from '../../store/supplements'
import { buildCoachContext, type CoachInputs } from '../../services/coach/coachContext'
import { getCoachPlan, CoachError, type CoachPlan } from '../../services/coach/coachPlan'
import { weightUnitLabel } from '../workouts/utils'

type Phase =
  | { status: 'profile' }
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'plan'; plan: CoachPlan }
  | { status: 'error'; message: string }

const FOCUS_STYLE: Record<CoachPlan['focus'], { label: string; cls: string }> = {
  train: { label: 'Train', cls: 'bg-emerald-500/15 text-emerald-300' },
  'active-recovery': { label: 'Active recovery', cls: 'bg-amber-500/15 text-amber-300' },
  rest: { label: 'Rest', cls: 'bg-sky-500/15 text-sky-300' },
}

function gather(): CoachInputs {
  const s = useSettingsStore.getState()
  const n = useNutritionStore.getState()
  const w = useWorkoutsStore.getState()
  const h = useHealthStore.getState()
  const b = useBodyStore.getState()
  const sup = useSupplementStore.getState()
  return {
    units: s.units,
    goals: s.goals,
    profile: s.profile,
    coachProfile: s.coachProfile,
    goalWeightKg: s.goalWeightKg,
    entries: n.entries,
    water: n.water,
    exerciseByDate: n.exercise,
    sessions: w.sessions,
    healthDays: h.days,
    bodyEntries: b.entries,
    supplements: sup.items,
    supplementLog: sup.log,
    routines: w.routines,
    availableEquipment: s.availableEquipment,
  }
}

export default function CoachSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const apiKey = useSettingsStore((s) => s.geminiApiKey)
  const units = useSettingsStore((s) => s.units)
  const coachProfile = useSettingsStore((s) => s.coachProfile)
  const [phase, setPhase] = useState<Phase>({ status: coachProfile ? 'idle' : 'profile' })
  const [followUp, setFollowUp] = useState('')

  async function generate(note?: string) {
    if (!apiKey.trim()) {
      setPhase({ status: 'error', message: 'Add a Gemini API key in Settings → AI to use the coach.' })
      return
    }
    setPhase({ status: 'loading' })
    try {
      const ctx = buildCoachContext(gather())
      const plan = await getCoachPlan(ctx, apiKey, note)
      setPhase({ status: 'plan', plan })
    } catch (err) {
      setPhase({ status: 'error', message: err instanceof CoachError ? err.message : 'Something went wrong.' })
    }
  }

  function startWorkout(plan: CoachPlan) {
    if (!plan.session) return
    navigate('/workouts', {
      state: {
        coachSession: {
          name: plan.session.name,
          items: plan.session.exercises.map((e) => ({ exerciseId: e.exerciseId, sets: e.sets, reps: e.reps })),
        },
      },
    })
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title="AI Coach">
      {phase.status === 'profile' && <ProfileForm onSaved={() => generate()} />}

      {phase.status === 'idle' && (
        <div className="space-y-3 py-2">
          <p className="text-sm text-slate-300">
            I'll read your last 5 days — training, recovery, nutrition and your goals — and give you a plan for today.
          </p>
          <Button variant="primary" full onClick={() => generate()}>
            <span className="flex items-center justify-center gap-1.5">
              <Sparkles size={16} /> Analyse my week & plan today
            </span>
          </Button>
          <button type="button" onClick={() => setPhase({ status: 'profile' })} className="text-xs text-slate-500 underline">
            Edit coaching goals
          </button>
        </div>
      )}

      {phase.status === 'loading' && (
        <div className="flex flex-col items-center gap-2 py-10 text-slate-400">
          <Loader2 size={26} className="animate-spin text-primary-400" />
          <span className="text-sm">Reading your last 5 days…</span>
        </div>
      )}

      {phase.status === 'error' && (
        <div className="space-y-3 py-2">
          <p className="text-sm text-amber-300">{phase.message}</p>
          <Button variant="ghost" full onClick={() => generate()}>
            Try again
          </Button>
        </div>
      )}

      {phase.status === 'plan' && (
        <PlanView plan={phase.plan} units={units} onStart={() => startWorkout(phase.plan)} onEditGoals={() => setPhase({ status: 'profile' })}>
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              const n = followUp.trim()
              if (n) {
                setFollowUp('')
                void generate(n)
              }
            }}
          >
            <input
              value={followUp}
              onChange={(e) => setFollowUp(e.target.value)}
              placeholder="Adjust it… e.g. only have 30 min, shoulder's sore"
              className="min-w-0 flex-1 rounded-lg bg-slate-800 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-primary-500"
            />
            <button
              type="submit"
              disabled={!followUp.trim()}
              aria-label="Adjust plan"
              className="shrink-0 rounded-lg bg-primary-500 p-2.5 text-slate-950 disabled:opacity-40"
            >
              <Send size={16} />
            </button>
          </form>
        </PlanView>
      )}
    </Sheet>
  )
}

function PlanView({
  plan,
  units,
  onStart,
  onEditGoals,
  children,
}: {
  plan: CoachPlan
  units: 'metric' | 'imperial'
  onStart: () => void
  onEditGoals: () => void
  children: ReactNode
}) {
  const focus = FOCUS_STYLE[plan.focus]
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-slate-500">Readiness</p>
          <p className="text-lg font-bold text-slate-100">{plan.readiness.word}</p>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${focus.cls}`}>{focus.label}</span>
      </div>
      {plan.readiness.line && <p className="text-xs text-slate-400">{plan.readiness.line}</p>}

      {plan.headline && <p className="rounded-lg bg-slate-800/60 px-3 py-2.5 text-sm font-medium text-slate-100">{plan.headline}</p>}

      {plan.session && (
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-3 space-y-2.5">
          <div className="flex items-center gap-2">
            <Dumbbell size={15} className="text-emerald-400" />
            <p className="text-sm font-semibold text-slate-100">{plan.session.name}</p>
          </div>
          <ul className="space-y-1.5">
            {plan.session.exercises.map((e, i) => (
              <li key={i} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0">
                  <span className="text-slate-100">{e.name}</span>
                  {e.note && <span className="block text-[11px] text-slate-500">{e.note}</span>}
                </span>
                <span className="shrink-0 tabular-nums text-slate-400">
                  {e.sets} × {e.reps}
                </span>
              </li>
            ))}
          </ul>
          <Button variant="primary" full onClick={onStart}>
            Start this workout
          </Button>
        </div>
      )}

      {(plan.nutrition.calories != null || plan.nutrition.protein != null || plan.nutrition.note) && (
        <div className="rounded-xl bg-slate-800/50 p-3 space-y-1">
          <div className="flex items-center gap-2">
            <Apple size={15} className="text-sky-400" />
            <p className="text-sm font-semibold text-slate-100">Fuel today</p>
          </div>
          {(plan.nutrition.calories != null || plan.nutrition.protein != null) && (
            <p className="text-sm text-slate-300">
              {plan.nutrition.calories != null && <>{plan.nutrition.calories.toLocaleString()} kcal</>}
              {plan.nutrition.calories != null && plan.nutrition.protein != null && ' · '}
              {plan.nutrition.protein != null && <>{plan.nutrition.protein} g protein</>}
            </p>
          )}
          {plan.nutrition.note && <p className="text-xs text-slate-400">{plan.nutrition.note}</p>}
        </div>
      )}

      {plan.priorities.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Target size={15} className="text-primary-400" />
            <p className="text-sm font-semibold text-slate-100">Today's priorities</p>
          </div>
          <ul className="space-y-1">
            {plan.priorities.map((p, i) => (
              <li key={i} className="flex gap-2 text-sm text-slate-300">
                <span className="text-primary-400">•</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {plan.rationale && <p className="text-[11px] leading-relaxed text-slate-500">{plan.rationale}</p>}

      <div className="border-t border-slate-800 pt-3">{children}</div>

      <button type="button" onClick={onEditGoals} className="text-xs text-slate-500 underline">
        Edit coaching goals
      </button>
      <p className="text-[10px] text-slate-600">
        AI guidance from your own data via Gemini — not medical advice. Weights in {weightUnitLabel(units)}.
      </p>
    </div>
  )
}

const GOALS: { value: CoachProfile['primaryGoal']; label: string }[] = [
  { value: 'build-muscle', label: 'Build muscle' },
  { value: 'lose-fat', label: 'Lose fat' },
  { value: 'strength', label: 'Get stronger' },
  { value: 'endurance', label: 'Endurance' },
  { value: 'general-health', label: 'General health' },
]
const LEVELS: { value: CoachProfile['experience']; label: string }[] = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
]

function ProfileForm({ onSaved }: { onSaved: () => void }) {
  const existing = useSettingsStore((s) => s.coachProfile)
  const setCoachProfile = useSettingsStore((s) => s.setCoachProfile)
  const [goal, setGoal] = useState<CoachProfile['primaryGoal']>(existing?.primaryGoal ?? 'build-muscle')
  const [experience, setExperience] = useState<CoachProfile['experience']>(existing?.experience ?? 'intermediate')
  const [daysPerWeek, setDaysPerWeek] = useState(existing?.daysPerWeek ?? 4)
  const [sessionMinutes, setSessionMinutes] = useState(existing?.sessionMinutes ?? 60)
  const [focus, setFocus] = useState(existing?.focus ?? '')
  const [constraints, setConstraints] = useState(existing?.constraints ?? '')
  const [dietNotes, setDietNotes] = useState(existing?.dietNotes ?? '')

  function save() {
    setCoachProfile({
      primaryGoal: goal,
      experience,
      daysPerWeek,
      sessionMinutes,
      focus: focus.trim() || undefined,
      constraints: constraints.trim() || undefined,
      dietNotes: dietNotes.trim() || undefined,
    })
    onSaved()
  }

  return (
    <div className="space-y-4 py-1">
      <p className="text-sm text-slate-300">Tell me your goals once so I can tailor every plan. You can change these anytime.</p>

      <div>
        <p className="mb-1.5 text-xs font-medium text-slate-400">Primary goal</p>
        <div className="flex flex-wrap gap-1.5">
          {GOALS.map((g) => (
            <Chip key={g.value} on={goal === g.value} onClick={() => setGoal(g.value)} label={g.label} />
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-medium text-slate-400">Experience</p>
        <div className="flex flex-wrap gap-1.5">
          {LEVELS.map((l) => (
            <Chip key={l.value} on={experience === l.value} onClick={() => setExperience(l.value)} label={l.label} />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">Days / week</span>
          <input
            type="number"
            inputMode="numeric"
            value={daysPerWeek}
            onChange={(e) => setDaysPerWeek(Math.min(7, Math.max(1, Number(e.target.value) || 1)))}
            className="w-full rounded-lg bg-slate-800 px-3 py-2 text-base text-slate-100 outline-none focus:ring-2 focus:ring-primary-500"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">Minutes / session</span>
          <input
            type="number"
            inputMode="numeric"
            value={sessionMinutes}
            onChange={(e) => setSessionMinutes(Math.min(180, Math.max(10, Number(e.target.value) || 10)))}
            className="w-full rounded-lg bg-slate-800 px-3 py-2 text-base text-slate-100 outline-none focus:ring-2 focus:ring-primary-500"
          />
        </label>
      </div>

      <Field label="Focus / preferences (optional)" value={focus} onChange={setFocus} placeholder="e.g. emphasise chest & arms, love deadlifts" />
      <Field label="Injuries / limitations (optional)" value={constraints} onChange={setConstraints} placeholder="e.g. cranky right shoulder, no overhead pressing" />
      <Field label="Diet notes (optional)" value={dietNotes} onChange={setDietNotes} placeholder="e.g. vegetarian, cutting, intermittent fasting" />

      <Button variant="primary" full onClick={save}>
        Save & get today's plan
      </Button>
    </div>
  )
}

function Chip({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-medium ${on ? 'bg-primary-500 text-slate-950' : 'bg-slate-800 text-slate-300'}`}
    >
      {label}
    </button>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder: string
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-400">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg bg-slate-800 px-3 py-2 text-base text-slate-100 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-primary-500"
      />
    </label>
  )
}

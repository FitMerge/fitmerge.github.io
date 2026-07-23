// The contract between the AI command parser and the app's data. The model NEVER
// touches stores directly — it emits a list of typed intents (RawAction) that we
// validate + resolve into AssistantAction (dates as ISO, weight in kg, supplement
// names matched to ids), preview to the user, and only then execute against the
// Zustand stores. That keeps a hallucinated field from silently corrupting data.

import type { MealType, Units } from '../../types'
import { lbToKg } from '../../lib/units'
import { todayISO } from '../../lib/date'
import { useBodyStore } from '../../store/body'
import { useNutritionStore } from '../../store/nutrition'
import { useSupplementStore } from '../../store/supplements'

export const CUP_ML = 250

/** What the model is asked to emit — loose, unvalidated. */
export type RawAction = {
  type?: string
  date?: string
  // weight
  weight?: number
  weightUnit?: string
  bodyFatPct?: number
  // water
  ml?: number
  oz?: number
  cups?: number
  // food
  name?: string
  mealType?: string
  calories?: number
  protein?: number
  carbs?: number
  fat?: number
  qty?: number
  unit?: string
  // supplement
  amount?: number
  // workout
  routineName?: string
}

export type AssistantAction =
  | { kind: 'weight'; date: string; weightKg: number; display: string; bodyFatPct?: number }
  | { kind: 'water'; date: string; ml: number; display: string }
  | {
      kind: 'food'
      date: string
      mealType: MealType
      name: string
      qty: number
      unit: string
      calories: number
      protein: number
      carbs: number
      fat: number
    }
  | { kind: 'supplement'; date: string; supplementId?: string; name: string; amount?: number; unit?: string; isNew: boolean }
  | { kind: 'startWorkout'; routineId?: string; routineName: string }
  | { kind: 'unknown'; text: string }

export type ActionContext = {
  today: string
  units: Units
  supplements: { id: string; name: string; unit?: string; targetAmount?: number }[]
  routines: { id: string; name: string }[]
}

const MEALS: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']

function safeDate(d: string | undefined, today: string): string {
  return typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : today
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined
}

/** Validate + resolve one raw action into a typed AssistantAction (or null to drop it). */
function resolveOne(raw: RawAction, ctx: ActionContext): AssistantAction | null {
  const date = safeDate(raw.date, ctx.today)
  switch (raw.type) {
    case 'logWeight': {
      const w = num(raw.weight)
      if (w === undefined || w <= 0) return null
      const unit = raw.weightUnit === 'kg' || (raw.weightUnit == null && ctx.units === 'metric') ? 'kg' : 'lb'
      const weightKg = unit === 'lb' ? lbToKg(w) : w
      const bf = num(raw.bodyFatPct)
      return { kind: 'weight', date, weightKg, display: `${w} ${unit}`, bodyFatPct: bf }
    }
    case 'logWater': {
      let ml = num(raw.ml)
      if (ml === undefined && num(raw.oz) !== undefined) ml = Math.round(num(raw.oz)! * 29.5735)
      if (ml === undefined && num(raw.cups) !== undefined) ml = Math.round(num(raw.cups)! * CUP_ML)
      if (ml === undefined || ml <= 0) return null
      return { kind: 'water', date, ml, display: `${ml} ml` }
    }
    case 'logFood': {
      const name = typeof raw.name === 'string' ? raw.name.trim() : ''
      const calories = num(raw.calories)
      if (!name || calories === undefined) return null
      const mealType = MEALS.includes(raw.mealType as MealType) ? (raw.mealType as MealType) : 'snack'
      return {
        kind: 'food',
        date,
        mealType,
        name,
        qty: num(raw.qty) ?? 1,
        unit: typeof raw.unit === 'string' && raw.unit.trim() ? raw.unit.trim() : 'serving',
        calories: Math.max(0, calories),
        protein: Math.max(0, num(raw.protein) ?? 0),
        carbs: Math.max(0, num(raw.carbs) ?? 0),
        fat: Math.max(0, num(raw.fat) ?? 0),
      }
    }
    case 'logSupplement': {
      const name = typeof raw.name === 'string' ? raw.name.trim() : ''
      if (!name) return null
      const match = ctx.supplements.find((s) => s.name.toLowerCase() === name.toLowerCase())
      return {
        kind: 'supplement',
        date,
        supplementId: match?.id,
        name: match?.name ?? name,
        amount: num(raw.amount) ?? match?.targetAmount,
        unit: raw.unit?.trim() || match?.unit,
        isNew: !match,
      }
    }
    case 'startWorkout': {
      const q = (raw.routineName ?? raw.name ?? '').trim()
      const match =
        ctx.routines.find((r) => r.name.toLowerCase() === q.toLowerCase()) ??
        ctx.routines.find((r) => q && r.name.toLowerCase().includes(q.toLowerCase()))
      return { kind: 'startWorkout', routineId: match?.id, routineName: match?.name ?? q }
    }
    default:
      return null
  }
}

export function resolveActions(raw: RawAction[], ctx: ActionContext): AssistantAction[] {
  return raw.map((r) => resolveOne(r, ctx)).filter((a): a is AssistantAction => a !== null)
}

/** Human-readable preview line for the confirm step. */
export function describeAction(a: AssistantAction, units: Units): { label: string; detail: string } {
  const when = (d: string) => (d === todayISO() ? 'Today' : d)
  switch (a.kind) {
    case 'weight':
      return { label: `Log weight ${a.display}${a.bodyFatPct ? ` · ${a.bodyFatPct}% bf` : ''}`, detail: when(a.date) }
    case 'water':
      return { label: `Add water ${units === 'imperial' ? `${Math.round(a.ml / 29.5735)} oz` : a.display}`, detail: when(a.date) }
    case 'food':
      return { label: `Log ${a.name} · ${Math.round(a.calories)} kcal`, detail: `${a.mealType} · ${when(a.date)}` }
    case 'supplement':
      return {
        label: `Log ${a.name}${a.amount ? ` ${a.amount}${a.unit ?? ''}` : ''}${a.isNew ? ' (new)' : ''}`,
        detail: when(a.date),
      }
    case 'startWorkout':
      return { label: `Start workout: ${a.routineName || 'pick one'}`, detail: a.routineId ? 'ready' : 'not found' }
    case 'unknown':
      return { label: a.text, detail: 'not understood' }
  }
}

export type ExecResult = { ok: boolean; message: string; navigateTo?: string; navigateState?: unknown }

/** Apply a resolved action to the stores. Pure side effects; returns a result for the toast. */
export function executeAction(a: AssistantAction): ExecResult {
  switch (a.kind) {
    case 'weight':
      useBodyStore.getState().upsertEntry({ date: a.date, weightKg: a.weightKg, bodyFatPct: a.bodyFatPct })
      return { ok: true, message: `Weight ${a.display} logged` }
    case 'water':
      useNutritionStore.getState().addWater(a.date, a.ml)
      return { ok: true, message: `Added ${a.ml} ml water` }
    case 'food':
      useNutritionStore.getState().addEntry({
        date: a.date,
        mealType: a.mealType,
        name: a.name,
        qty: a.qty,
        unit: a.unit,
        calories: a.calories,
        protein: a.protein,
        carbs: a.carbs,
        fat: a.fat,
      })
      return { ok: true, message: `${a.name} logged` }
    case 'supplement': {
      const store = useSupplementStore.getState()
      let id = a.supplementId
      if (!id) id = store.addItem({ name: a.name, unit: a.unit, targetAmount: a.amount })
      store.addDose(a.date, id, a.amount)
      return { ok: true, message: `${a.name} logged` }
    }
    case 'startWorkout':
      if (!a.routineId) return { ok: false, message: `No routine matching "${a.routineName}"` }
      return { ok: true, message: `Starting ${a.routineName}`, navigateTo: '/workouts', navigateState: { startRoutineId: a.routineId } }
    case 'unknown':
      return { ok: false, message: "Didn't understand that" }
  }
}

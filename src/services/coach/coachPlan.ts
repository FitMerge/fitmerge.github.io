// The AI coach: turns a CoachContext (last-5-day summary) into a validated,
// actionable plan for today. Mirrors the assistant parser's safety model — the
// model returns strict JSON, which we validate into a typed CoachPlan and, most
// importantly, constrain every recommended exercise to the user's real library
// so a hallucinated move can never reach the workout logger.

import { generateContent } from '../gemini/model'
import { getExerciseById } from '../../data/exercises'
import type { CoachContext } from './coachContext'
import type { CoachProfile } from '../../store/settings'
import type { Goals } from '../../types'

export class CoachError extends Error {}

const GOAL_VALUES: CoachProfile['primaryGoal'][] = ['build-muscle', 'lose-fat', 'strength', 'endurance', 'general-health']
const EXPERIENCE_VALUES: CoachProfile['experience'][] = ['beginner', 'intermediate', 'advanced']

/** Goal/profile changes the coach applies when the user asks via chat. */
export type CoachUpdates = {
  profile?: Partial<CoachProfile>
  goals?: Partial<Goals>
  /** New goal body weight in the user's display unit (converted to kg on apply). */
  goalWeight?: number
  summary: string
}

export type CoachFocus = 'train' | 'active-recovery' | 'rest'

export type CoachExercisePrescription = {
  exerciseId: string
  name: string
  muscleGroup: string
  sets: number
  reps: number
  note?: string
}

export type CoachPlan = {
  readiness: { word: string; line: string }
  focus: CoachFocus
  headline: string
  session: { name: string; type: string; exercises: CoachExercisePrescription[] } | null
  nutrition: { calories: number | null; protein: number | null; note: string }
  priorities: string[]
  rationale: string
  /** Present only when a chat follow-up asked to change goals/profile. */
  updates?: CoachUpdates
}

const SYSTEM = `You are a certified strength & conditioning and nutrition coach. Analyse the user's last 5 days of data and give ONE focused, realistic plan for TODAY that moves them toward their stated goal.

Principles:
- Use the actual numbers; be specific, encouraging, and concise.
- Adapt intensity to recovery: if form (TSB) is very negative, ACWR is high/danger, or recovery flags are red/amber, prescribe active recovery or rest — not a hard session. If they're fresh and under-recovered days are behind them, push.
- Respect the coach profile: goal, experience, days/week, session length, and especially any injuries/constraints (never program around them).
- If you prescribe a workout, choose exercises ONLY from the AVAILABLE EXERCISES list, by their exact exerciseId, matched to today's focus, the user's equipment, experience, and session length. Give sets and reps per exercise.
- Nutrition targets must fit the goal (e.g. protein high for muscle/fat-loss; a sensible calorie target vs their logged intake).

Respond with STRICT JSON only — no markdown, no code fences — exactly this shape:
{"readiness":{"word":string,"line":string},"focus":"train"|"active-recovery"|"rest","headline":string,"session":{"name":string,"type":string,"exercises":[{"exerciseId":string,"sets":number,"reps":number,"note":string}]}|null,"nutrition":{"calories":number,"protein":number,"note":string},"priorities":[string,string],"rationale":string}

Rules:
- readiness.word: 1–2 words (e.g. "Primed", "Run down"). readiness.line: one sentence on today's recovery.
- focus: choose from recovery + today's schedule.
- session: null on a rest day; otherwise 3–7 exercises drawn from AVAILABLE EXERCISES sized to ~the session length.
- nutrition.calories / nutrition.protein: today's numeric targets; note: one actionable sentence.
- priorities: 2–3 short strings — the highest-impact things to do today.
- rationale: 1–2 sentences citing the data behind the plan.

If (and only if) the USER FOLLOW-UP asks to change their goals or profile — primary goal, experience, days/week, session length, focus, injuries, diet, calorie/macro targets, or goal body weight — ALSO include an "updates" object with ONLY the changed fields, and generate the rest of the plan using those UPDATED values. Confirm the change in updates.summary (one sentence). Omit "updates" entirely for plan-only tweaks like "only 30 min today". Shape:
"updates":{"profile":{"primaryGoal":"build-muscle"|"lose-fat"|"strength"|"endurance"|"general-health","experience":"beginner"|"intermediate"|"advanced","daysPerWeek":number,"sessionMinutes":number,"focus":string,"constraints":string,"dietNotes":string},"goals":{"calories":number,"protein":number,"carbs":number,"fat":number},"goalWeight":number,"summary":string}
goalWeight is in the user's weight unit shown in the data. Current goals and profile are in the USER DATA — only include fields the user actually asked to change.`

function stripFences(text: string): string {
  const t = text.trim()
  const m = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  return m ? m[1] : t
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

function clampInt(v: number | undefined, lo: number, hi: number, fallback: number): number {
  if (v === undefined) return fallback
  return Math.min(hi, Math.max(lo, Math.round(v)))
}

function buildPrompt(ctx: CoachContext, followUp?: string): string {
  // Library goes in its own section (compact) so the model has a clear id menu;
  // strip it from the JSON to avoid doubling the tokens.
  const { library, ...rest } = ctx
  const libLines = library.map((e) => `${e.id} — ${e.name} (${e.muscleGroup}, ${e.equipment})`).join('\n')
  return [
    SYSTEM,
    '---',
    `USER DATA (JSON, weights in ${ctx.units === 'imperial' ? 'lb' : 'kg'}):`,
    JSON.stringify(rest),
    '',
    'AVAILABLE EXERCISES (use these exerciseId values only):',
    libLines || '(none — user has no equipment set; suggest bodyweight movements by name in notes and leave session null)',
    followUp ? `\nUSER FOLLOW-UP (adjust today's plan accordingly): ${followUp}` : '',
  ].join('\n')
}

/** Validate goal/profile edits the model proposes, dropping anything malformed.
 * Returns undefined if nothing valid actually changed. */
function parseUpdates(value: unknown): CoachUpdates | undefined {
  if (!value || typeof value !== 'object') return undefined
  const u = value as Record<string, unknown>

  let profile: Partial<CoachProfile> | undefined
  if (u.profile && typeof u.profile === 'object') {
    const p = u.profile as Record<string, unknown>
    const out: Partial<CoachProfile> = {}
    const goal = str(p.primaryGoal) as CoachProfile['primaryGoal']
    if (GOAL_VALUES.includes(goal)) out.primaryGoal = goal
    const exp = str(p.experience) as CoachProfile['experience']
    if (EXPERIENCE_VALUES.includes(exp)) out.experience = exp
    const dpw = num(p.daysPerWeek)
    if (dpw !== undefined) out.daysPerWeek = clampInt(dpw, 1, 7, 4)
    const sm = num(p.sessionMinutes)
    if (sm !== undefined) out.sessionMinutes = clampInt(sm, 10, 180, 60)
    if (typeof p.focus === 'string') out.focus = p.focus.trim() || undefined
    if (typeof p.constraints === 'string') out.constraints = p.constraints.trim() || undefined
    if (typeof p.dietNotes === 'string') out.dietNotes = p.dietNotes.trim() || undefined
    if (Object.keys(out).length > 0) profile = out
  }

  let goals: Partial<Goals> | undefined
  if (u.goals && typeof u.goals === 'object') {
    const g = u.goals as Record<string, unknown>
    const out: Partial<Goals> = {}
    for (const k of ['calories', 'protein', 'carbs', 'fat'] as const) {
      const v = num(g[k])
      if (v !== undefined && v >= 0) out[k] = Math.round(Math.min(v, k === 'calories' ? 20000 : 2000))
    }
    if (Object.keys(out).length > 0) goals = out
  }

  const gw = num(u.goalWeight)
  const goalWeight = gw !== undefined && gw > 0 && gw < 2000 ? Math.round(gw * 10) / 10 : undefined

  if (!profile && !goals && goalWeight === undefined) return undefined
  return { profile, goals, goalWeight, summary: str(u.summary) }
}

/** Validate + normalise the model's JSON into a typed CoachPlan. Unknown exercise
 * ids are dropped; numbers are clamped; missing fields get safe defaults. */
export function parseCoachPlan(raw: string): CoachPlan {
  let parsed: unknown
  try {
    parsed = JSON.parse(stripFences(raw))
  } catch {
    throw new CoachError("Couldn't read the coach's response — try again.")
  }
  const o = (parsed && typeof parsed === 'object' ? parsed : {}) as Record<string, unknown>

  const focusRaw = str(o.focus)
  const focus: CoachFocus = focusRaw === 'rest' || focusRaw === 'active-recovery' ? focusRaw : 'train'

  const readiness = (o.readiness && typeof o.readiness === 'object' ? o.readiness : {}) as Record<string, unknown>
  const nutrition = (o.nutrition && typeof o.nutrition === 'object' ? o.nutrition : {}) as Record<string, unknown>

  let session: CoachPlan['session'] = null
  const sRaw = o.session && typeof o.session === 'object' ? (o.session as Record<string, unknown>) : null
  if (sRaw && Array.isArray(sRaw.exercises)) {
    const exercises: CoachExercisePrescription[] = []
    for (const item of sRaw.exercises as unknown[]) {
      if (!item || typeof item !== 'object') continue
      const e = item as Record<string, unknown>
      const ex = getExerciseById(str(e.exerciseId))
      if (!ex) continue // never let a hallucinated exercise through
      exercises.push({
        exerciseId: ex.id,
        name: ex.name,
        muscleGroup: ex.muscleGroup,
        sets: clampInt(num(e.sets), 1, 10, 3),
        reps: clampInt(num(e.reps), 1, 100, 10),
        note: str(e.note) || undefined,
      })
    }
    if (exercises.length > 0) session = { name: str(sRaw.name) || 'Recommended session', type: str(sRaw.type) || 'workout', exercises }
  }

  const cals = num(nutrition.calories)
  const protein = num(nutrition.protein)

  return {
    readiness: { word: str(readiness.word) || 'Today', line: str(readiness.line) },
    focus,
    headline: str(o.headline),
    session,
    nutrition: {
      calories: cals !== undefined ? Math.max(0, Math.round(cals)) : null,
      protein: protein !== undefined ? Math.max(0, Math.round(protein)) : null,
      note: str(nutrition.note),
    },
    priorities: Array.isArray(o.priorities) ? (o.priorities as unknown[]).map(str).filter(Boolean).slice(0, 5) : [],
    rationale: str(o.rationale),
    updates: parseUpdates(o.updates),
  }
}

/** Ask the coach for today's plan. Throws CoachError on missing key / AI failure. */
export async function getCoachPlan(ctx: CoachContext, apiKey: string, followUp?: string): Promise<CoachPlan> {
  if (!apiKey.trim()) throw new CoachError('Add a Gemini API key in Settings → AI to use the coach.')

  const body = {
    contents: [{ parts: [{ text: buildPrompt(ctx, followUp) }] }],
    generationConfig: { response_mime_type: 'application/json', temperature: 0.3 },
  }

  let raw: string
  try {
    raw = await generateContent('text', apiKey, body)
  } catch (err) {
    throw new CoachError(err instanceof Error ? err.message : 'The coach is unavailable right now.')
  }
  return parseCoachPlan(raw)
}

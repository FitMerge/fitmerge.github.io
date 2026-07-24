// Natural-language command parser. Sends the user's typed/spoken text to Gemini
// (the lite model — cheap, high free-tier limit) and asks for a strict-JSON list
// of intents, which we then validate + resolve via intents.ts. Text in, structured
// actions out — the model never sees or touches the stores.

import { generateContent } from '../gemini/model'
import { resolveActions, type ActionContext, type AssistantAction, type RawAction } from './intents'

export class AssistantError extends Error {}

export type ParseResult = { actions: AssistantAction[]; reply: string }

function buildPrompt(ctx: ActionContext): string {
  const suppList = ctx.supplements.length
    ? ctx.supplements.map((s) => s.name).join(', ')
    : '(none yet)'
  const routineList = ctx.routines.length ? ctx.routines.map((r) => r.name).join(', ') : '(none yet)'
  return `You turn a fitness-app user's message into a JSON list of logging actions.

Today is ${ctx.today}. The user's preferred weight unit is ${ctx.units === 'imperial' ? 'pounds (lb)' : 'kilograms (kg)'}.
Known supplements/habits: ${suppList}.
Known workout routines: ${routineList}.

Respond with STRICT JSON only — no markdown, no code fences, no commentary — exactly:
{"reply": string, "actions": [ ... ]}

"reply" is a short friendly confirmation of what you understood (one sentence).
Each action is one object. Use ONLY these shapes; omit fields that don't apply:

- Log body weight:
  {"type":"logWeight","date":"YYYY-MM-DD","weight":number,"weightUnit":"lb"|"kg","bodyFatPct":number?}
- Log water/fluids — give the amount in the unit the user said and DON'T convert (the app converts precisely); include exactly one of oz/ml/cups:
  {"type":"logWater","date":"YYYY-MM-DD","oz":number}     // fluid ounces
  {"type":"logWater","date":"YYYY-MM-DD","ml":number}     // millilitres (litres → ml: 1 L = 1000 ml)
  {"type":"logWater","date":"YYYY-MM-DD","cups":number}   // cups
- Log a food/meal (ESTIMATE macros for the portion described):
  {"type":"logFood","date":"YYYY-MM-DD","name":string,"mealType":"breakfast"|"lunch"|"dinner"|"snack","calories":number,"protein":number,"carbs":number,"fat":number,"qty":number?,"unit":string?}
- Log a supplement/habit (creatine, vitamins, etc.):
  {"type":"logSupplement","date":"YYYY-MM-DD","name":string,"amount":number?,"unit":string?}
- Start a planned strength workout (one of the known routines):
  {"type":"startWorkout","routineName":string}
- Log a COMPLETED cardio/activity session (soccer, run, walk, bike, hike, swim, tennis, yoga, etc.):
  {"type":"logActivity","date":"YYYY-MM-DD","name":string,"durationMin":number,"kcal":number?,"distanceKm":number?}

Rules:
- Resolve relative dates ("today","yesterday","last monday") to YYYY-MM-DD using today's date above. Default to today when unstated.
- A single message may contain several actions (e.g. two weigh-ins) — return one object each.
- If weightUnit is not stated, use the user's preferred unit.
- startWorkout is ONLY for starting one of the known routines listed above. Anything else the user "did" (a sport, run, walk, ride, hike, class) is a COMPLETED activity → use logActivity.
- For logActivity: give "name" in Title Case (e.g. "Indoor Soccer", "Running", "Trail Hike"). Convert any distance to kilometres (1 mile = 1.609 km). You MAY estimate kcal from the activity + duration; omit it if unsure.
- If you cannot map the message to any action, return an empty "actions" array and explain briefly in "reply".
- Match supplement and routine names to the known lists above when possible; otherwise use the user's wording.`
}

function stripFences(text: string): string {
  const t = text.trim()
  const m = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  return m ? m[1] : t
}

export async function parseCommand(text: string, ctx: ActionContext, apiKey: string): Promise<ParseResult> {
  if (!apiKey.trim()) throw new AssistantError('Add a Gemini API key in Settings → AI to use text commands.')
  if (!text.trim()) throw new AssistantError('Type or say what you want to log.')

  const body = {
    contents: [{ parts: [{ text: `${buildPrompt(ctx)}\n\n---\nUser message: ${text.trim()}` }] }],
    generationConfig: { response_mime_type: 'application/json', temperature: 0 },
  }

  let raw: string
  try {
    raw = await generateContent('text', apiKey, body)
  } catch (err) {
    throw new AssistantError(err instanceof Error ? err.message : 'The assistant is unavailable.')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(stripFences(raw))
  } catch {
    throw new AssistantError("Couldn't understand that — try rephrasing.")
  }

  const obj = (typeof parsed === 'object' && parsed !== null ? parsed : {}) as { reply?: unknown; actions?: unknown }
  const rawActions: RawAction[] = Array.isArray(obj.actions) ? (obj.actions as RawAction[]) : []
  const reply = typeof obj.reply === 'string' ? obj.reply : ''
  return { actions: resolveActions(rawActions, ctx), reply }
}

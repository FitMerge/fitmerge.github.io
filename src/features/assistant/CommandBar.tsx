import { useMemo, useState } from 'react'
import { Check, CornerDownLeft, Loader2, Mic, Sparkles, X } from 'lucide-react'
import { useSettingsStore } from '../../store/settings'
import { useSupplementStore } from '../../store/supplements'
import { useWorkoutsStore } from '../../store/workouts'
import { todayISO } from '../../lib/date'
import { AssistantError, parseCommand, type ParseResult } from '../../services/assistant/parse'
import { describeAction, executeAction, type ActionContext } from '../../services/assistant/intents'
import { useSpeech } from './useSpeech'

type CommandBarProps = {
  onNavigate: (to: string, state: unknown) => void
  onDone: () => void
}

type Phase =
  | { status: 'idle' }
  | { status: 'parsing' }
  | { status: 'preview'; result: ParseResult; include: boolean[] }
  | { status: 'done'; messages: string[] }
  | { status: 'error'; message: string }

const EXAMPLES = ['log 172 lb today and 172.5 yesterday', '60 min indoor soccer', 'ran 5k in 26 min', 'took creatine', 'ate 2 eggs and toast for breakfast']

export default function CommandBar({ onNavigate, onDone }: CommandBarProps) {
  const apiKey = useSettingsStore((s) => s.geminiApiKey)
  const units = useSettingsStore((s) => s.units)
  const supplements = useSupplementStore((s) => s.items)
  const routines = useWorkoutsStore((s) => s.routines)

  const [text, setText] = useState('')
  const [phase, setPhase] = useState<Phase>({ status: 'idle' })

  const ctx: ActionContext = useMemo(
    () => ({
      today: todayISO(),
      units,
      supplements: supplements.map((s) => ({ id: s.id, name: s.name, unit: s.unit, targetAmount: s.targetAmount })),
      routines: routines.map((r) => ({ id: r.id, name: r.name })),
    }),
    [units, supplements, routines],
  )

  async function run(input: string) {
    const q = input.trim()
    if (!q) return
    setPhase({ status: 'parsing' })
    try {
      const result = await parseCommand(q, ctx, apiKey)
      setPhase({ status: 'preview', result, include: result.actions.map(() => true) })
    } catch (err) {
      setPhase({ status: 'error', message: err instanceof AssistantError ? err.message : 'Something went wrong.' })
    }
  }

  const speech = useSpeech((t) => {
    setText(t)
    void run(t)
  })

  function confirm() {
    if (phase.status !== 'preview') return
    const messages: string[] = []
    let navTo: string | null = null
    let navState: unknown = null
    for (let i = 0; i < phase.result.actions.length; i++) {
      if (!phase.include[i]) continue
      const r = executeAction(phase.result.actions[i])
      messages.push((r.ok ? '✓ ' : '✕ ') + r.message)
      if (r.ok && r.navigateTo) {
        navTo = r.navigateTo
        navState = r.navigateState
      }
    }
    setText('')
    if (navTo) {
      onNavigate(navTo, navState)
      onDone()
      return
    }
    setPhase({ status: 'done', messages })
  }

  function reset() {
    setText('')
    setPhase({ status: 'idle' })
  }

  const busy = phase.status === 'parsing'

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
      <div className="flex items-center gap-1.5 text-xs font-medium text-primary-300">
        <Sparkles size={14} />
        Tell Rung what to log
      </div>

      <form
        className="mt-2 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void run(text)
        }}
      >
        <input
          value={speech.listening && speech.interim ? speech.interim : text}
          onChange={(e) => setText(e.target.value)}
          placeholder={speech.listening ? 'Listening…' : 'e.g. log 172 lb today'}
          disabled={busy}
          className="min-w-0 flex-1 rounded-lg bg-slate-800 px-3 py-2.5 text-base text-slate-100 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-primary-500"
        />
        {speech.supported && (
          <button
            type="button"
            onClick={() => (speech.listening ? speech.stop() : speech.start())}
            aria-label={speech.listening ? 'Stop voice input' : 'Start voice input'}
            className={`shrink-0 rounded-lg p-2.5 ${
              speech.listening ? 'bg-rose-500/20 text-rose-300 animate-pulse' : 'bg-slate-800 text-slate-300 active:bg-slate-700'
            }`}
          >
            <Mic size={18} />
          </button>
        )}
        <button
          type="submit"
          disabled={busy || !text.trim()}
          aria-label="Send command"
          className="shrink-0 rounded-lg bg-primary-500 p-2.5 text-slate-950 disabled:opacity-40"
        >
          {busy ? <Loader2 size={18} className="animate-spin" /> : <CornerDownLeft size={18} />}
        </button>
      </form>

      {speech.error && <p className="mt-2 text-xs text-amber-400">{speech.error}</p>}

      {phase.status === 'idle' && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => {
                setText(ex)
                void run(ex)
              }}
              className="rounded-full bg-slate-800/70 px-2.5 py-1 text-[11px] text-slate-400 active:bg-slate-700"
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      {phase.status === 'error' && (
        <div className="mt-2 flex items-start gap-2 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
          <X size={14} className="mt-0.5 shrink-0" />
          <span>{phase.message}</span>
        </div>
      )}

      {phase.status === 'preview' && (
        <div className="mt-3 space-y-2">
          {phase.result.reply && <p className="text-xs text-slate-400">{phase.result.reply}</p>}

          {phase.result.actions.length === 0 ? (
            <button type="button" onClick={reset} className="text-xs text-primary-400 underline">
              Try again
            </button>
          ) : (
            <>
              <ul className="space-y-1.5">
                {phase.result.actions.map((a, i) => {
                  const d = describeAction(a, units)
                  const on = phase.include[i]
                  return (
                    <li key={i}>
                      <button
                        type="button"
                        onClick={() =>
                          setPhase({ ...phase, include: phase.include.map((v, j) => (j === i ? !v : v)) })
                        }
                        className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left ${
                          on ? 'bg-slate-800' : 'bg-slate-800/40 opacity-50'
                        }`}
                      >
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded ${
                            on ? 'bg-primary-500 text-slate-950' : 'border border-slate-600'
                          }`}
                        >
                          {on && <Check size={14} />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-slate-100">{d.label}</span>
                          <span className="block text-[11px] text-slate-500">{d.detail}</span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={confirm}
                  disabled={phase.include.every((v) => !v)}
                  className="flex-1 rounded-lg bg-primary-500 py-2 text-sm font-semibold text-slate-950 disabled:opacity-40"
                >
                  Confirm
                </button>
                <button type="button" onClick={reset} className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-slate-300">
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {phase.status === 'done' && (
        <div className="mt-3 space-y-2">
          <ul className="space-y-1 rounded-lg bg-emerald-500/10 px-3 py-2">
            {phase.messages.map((m, i) => (
              <li key={i} className="text-xs text-emerald-300">
                {m}
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <button type="button" onClick={reset} className="flex-1 rounded-lg bg-slate-800 py-2 text-sm text-slate-200">
              Log something else
            </button>
            <button type="button" onClick={onDone} className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-slate-300">
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

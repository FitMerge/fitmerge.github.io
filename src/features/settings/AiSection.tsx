import { useState } from 'react'
import { Check, ExternalLink, Eye, EyeOff, Sparkles } from 'lucide-react'
import Card from '../../components/Card'
import Button from '../../components/Button'
import { useSettingsStore } from '../../store/settings'

export const AI_STUDIO_URL = 'https://aistudio.google.com/apikey'

export default function AiSection() {
  const geminiApiKey = useSettingsStore((s) => s.geminiApiKey)
  const setGeminiApiKey = useSettingsStore((s) => s.setGeminiApiKey)

  const [draft, setDraft] = useState(geminiApiKey)
  const [showKey, setShowKey] = useState(false)
  const [saved, setSaved] = useState(false)

  const isSet = geminiApiKey.trim().length > 0

  function handleSave() {
    setGeminiApiKey(draft.trim())
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function handleClear() {
    setDraft('')
    setGeminiApiKey('')
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles size={16} className="text-primary-400" />
        <h2 className="text-sm font-semibold text-slate-200">AI features</h2>
      </div>

      {isSet ? (
        <p className="flex items-center gap-1.5 text-sm text-emerald-400">
          <Check size={15} /> AI is on — coach, photo logging and voice commands all work.
        </p>
      ) : (
        <>
          <p className="text-sm text-slate-400">
            Rung can read your food photos, act as your coach, and let you log by talking. Google
            gives this away free — it takes about a minute to switch on.
          </p>
          <ol className="list-decimal space-y-1.5 pl-4 text-sm text-slate-400">
            <li>Tap the button below and sign in with Google.</li>
            <li>
              Tap <span className="text-slate-300">Create API key</span>, then copy the long code it
              gives you.
            </li>
            <li>Come back here and paste it in.</li>
          </ol>
          <a
            href={AI_STUDIO_URL}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-1.5 rounded-lg bg-slate-800 px-3 py-2.5 text-sm font-medium text-primary-400 active:bg-slate-700"
          >
            Open Google AI Studio <ExternalLink size={14} />
          </a>
        </>
      )}

      <div>
        <label className="mb-1 block text-sm text-slate-400">
          {isSet ? 'Your code' : 'Paste your code here'}
        </label>
        <div className="relative">
          <input
            type={showKey ? 'text' : 'password'}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="AIza…"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="w-full rounded-lg bg-slate-800 py-2.5 pl-3 pr-10 text-base text-slate-100 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-primary-500"
          />
          <button
            type="button"
            onClick={() => setShowKey((v) => !v)}
            aria-label={showKey ? 'Hide code' : 'Show code'}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400"
          >
            {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        <Button variant="primary" full onClick={handleSave} disabled={!draft.trim() && !isSet}>
          {saved ? 'Saved ✓' : 'Save'}
        </Button>
        {isSet && (
          <Button variant="ghost" full onClick={handleClear}>
            Remove
          </Button>
        )}
      </div>

      <p className="text-xs text-slate-500">
        Your code stays in your own account. Everything except the AI features works without it.
      </p>
    </Card>
  )
}

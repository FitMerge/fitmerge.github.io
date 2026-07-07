import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import Card from '../../components/Card'
import Button from '../../components/Button'
import { useSettingsStore } from '../../store/settings'

export default function AiSection() {
  const geminiApiKey = useSettingsStore((s) => s.geminiApiKey)
  const setGeminiApiKey = useSettingsStore((s) => s.setGeminiApiKey)

  const [draft, setDraft] = useState(geminiApiKey)
  const [showKey, setShowKey] = useState(false)

  const isSet = geminiApiKey.trim().length > 0

  function handleSave() {
    setGeminiApiKey(draft.trim())
  }

  function handleClear() {
    setDraft('')
    setGeminiApiKey('')
  }

  return (
    <Card className="space-y-3">
      <h2 className="text-sm font-semibold text-slate-200">AI photo analysis</h2>

      <div>
        <label className="block text-sm text-slate-400 mb-1">Gemini API key</label>
        <div className="relative">
          <input
            type={showKey ? 'text' : 'password'}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Paste your API key"
            className="w-full bg-slate-800 rounded-lg pl-3 pr-10 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-primary-500"
          />
          <button
            type="button"
            onClick={() => setShowKey((v) => !v)}
            aria-label={showKey ? 'Hide key' : 'Show key'}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400"
          >
            {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs">
        <span className={`w-2 h-2 rounded-full ${isSet ? 'bg-emerald-400' : 'bg-amber-400'}`} />
        <span className="text-slate-400">{isSet ? 'Gemini AI enabled' : 'Demo mode — using sample results'}</span>
      </div>

      <p className="text-xs text-slate-500">
        Get a free key at{' '}
        <a
          href="https://aistudio.google.com/apikey"
          target="_blank"
          rel="noreferrer"
          className="text-primary-400 underline"
        >
          aistudio.google.com
        </a>
      </p>

      <div className="flex gap-2">
        <Button variant="primary" full onClick={handleSave}>
          Save key
        </Button>
        {isSet && (
          <Button variant="ghost" full onClick={handleClear}>
            Clear key
          </Button>
        )}
      </div>
    </Card>
  )
}

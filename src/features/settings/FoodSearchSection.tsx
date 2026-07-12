import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import Card from '../../components/Card'
import Button from '../../components/Button'
import { useSettingsStore } from '../../store/settings'

// Optional personal USDA FoodData Central key. Search works without one (shared
// DEMO_KEY), but a free personal key lifts the ~30 req/hour rate limit. Stored
// device-local, never synced.
export default function FoodSearchSection() {
  const usdaApiKey = useSettingsStore((s) => s.usdaApiKey)
  const setUsdaApiKey = useSettingsStore((s) => s.setUsdaApiKey)

  const [draft, setDraft] = useState(usdaApiKey)
  const [showKey, setShowKey] = useState(false)

  const isSet = usdaApiKey.trim().length > 0

  return (
    <Card className="space-y-3">
      <h2 className="text-sm font-semibold text-slate-200">Food search</h2>
      <p className="text-xs text-slate-500">
        Searches your built-in library first, then the USDA generic-food database, then branded
        products. Adding a free USDA key removes the shared rate limit.
      </p>

      <div>
        <label className="block text-sm text-slate-400 mb-1">USDA API key (optional)</label>
        <div className="relative">
          <input
            type={showKey ? 'text' : 'password'}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Paste your free USDA key"
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
        <span className="text-slate-400">
          {isSet ? 'Personal USDA key active — no rate limit' : 'Using shared key (rate-limited)'}
        </span>
      </div>

      <p className="text-xs text-slate-500">
        Get a free key in ~30 seconds at{' '}
        <a
          href="https://fdc.nal.usda.gov/api-key-signup.html"
          target="_blank"
          rel="noreferrer"
          className="text-primary-400 underline"
        >
          fdc.nal.usda.gov
        </a>
      </p>

      <div className="flex gap-2">
        <Button variant="primary" full onClick={() => setUsdaApiKey(draft.trim())}>
          Save key
        </Button>
        {isSet && (
          <Button
            variant="ghost"
            full
            onClick={() => {
              setDraft('')
              setUsdaApiKey('')
            }}
          >
            Clear key
          </Button>
        )}
      </div>
    </Card>
  )
}

import { useState } from 'react'
import { ChevronDown, ChevronUp, Eye, EyeOff } from 'lucide-react'
import Card from '../../components/Card'
import Button from '../../components/Button'
import { useSettingsStore } from '../../store/settings'

// Optional personal USDA FoodData Central key. Search works without one (shared
// DEMO_KEY), but a free personal key lifts the ~30 req/hour rate limit. Synced
// privately to the user's own account alongside the other keys.
export default function FoodSearchSection() {
  const usdaApiKey = useSettingsStore((s) => s.usdaApiKey)
  const setUsdaApiKey = useSettingsStore((s) => s.setUsdaApiKey)

  const [draft, setDraft] = useState(usdaApiKey)
  const [showKey, setShowKey] = useState(false)
  // Almost nobody needs this — food search works out of the box — so keep it
  // out of the way rather than presenting a new user with an unexplained field.
  const [open, setOpen] = useState(false)

  const isSet = usdaApiKey.trim().length > 0

  return (
    <Card className="space-y-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between"
      >
        <span className="text-sm font-semibold text-slate-200">Food search</span>
        {open ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
      </button>

      <p className="text-xs text-slate-500">
        {isSet
          ? 'Faster searching is switched on.'
          : 'Works as-is. If searching ever feels slow, you can speed it up below.'}
      </p>

      {open && (
        <>
          <p className="text-xs text-slate-500">
            Rung searches its own food library first, then a free US government food database.
            That shared database limits how often everyone can use it. Getting your own free pass
            (about 30 seconds) removes that limit for you.
          </p>

          <a
            href="https://fdc.nal.usda.gov/api-key-signup.html"
            target="_blank"
            rel="noreferrer"
            className="block rounded-lg bg-slate-800 px-3 py-2.5 text-center text-sm font-medium text-primary-400 active:bg-slate-700"
          >
            Get a free pass
          </a>

          <div>
            <label className="mb-1 block text-sm text-slate-400">Paste it here</label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Paste the code you were emailed"
                autoCapitalize="none"
                autoCorrect="off"
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
            <Button variant="primary" full onClick={() => setUsdaApiKey(draft.trim())}>
              Save
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
                Remove
              </Button>
            )}
          </div>
        </>
      )}
    </Card>
  )
}

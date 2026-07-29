import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Camera, ChevronRight, Loader2, Repeat2 } from 'lucide-react'
import Button from '../../components/Button'
import Card from '../../components/Card'
import EmptyState from '../../components/EmptyState'
import RefineFoodItemSheet from './RefineFoodItemSheet'
import { fileToDownscaledDataUrl, dataUrlToThumb } from '../../lib/image'
import { savePhotoThumb } from '../../services/photoStore'
import { analyzeFoodPhoto, VisionError } from '../../services/vision'
import type { FoodAnalysisItem } from '../../services/vision'
import { useNutritionStore } from '../../store/nutrition'
import { useSettingsStore } from '../../store/settings'
import type { MealType } from '../../types'

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']

type Stage = 'pick' | 'preview' | 'analyzing' | 'review' | 'error'

type ReviewItem = FoodAnalysisItem & {
  id: string
  included: boolean
}

type AddPhotoTabProps = {
  date: string
  defaultMealType?: MealType
  onClose: () => void
}

export default function AddPhotoTab({ date, defaultMealType, onClose }: AddPhotoTabProps) {
  const addEntry = useNutritionStore((s) => s.addEntry)
  const geminiApiKey = useSettingsStore((s) => s.geminiApiKey)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const [stage, setStage] = useState<Stage>('pick')
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null)
  const [items, setItems] = useState<ReviewItem[]>([])
  // Which item's adjust sheet is open. Same component as the describe path, so
  // a correction works identically however the food got identified.
  const [refiningId, setRefiningId] = useState<string | null>(null)
  const [provider, setProvider] = useState<'mock' | 'gemini'>('mock')
  const [mealType, setMealType] = useState<MealType>(defaultMealType ?? 'breakfast')
  const [errorMessage, setErrorMessage] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    try {
      const downscaled = await fileToDownscaledDataUrl(file, 1024)
      setImageDataUrl(downscaled)
      setStage('preview')
    } catch {
      setErrorMessage('Could not read that photo — please try another.')
      setStage('error')
    }
  }

  function openPicker() {
    fileInputRef.current?.click()
  }

  async function handleAnalyze() {
    if (!imageDataUrl) return
    setStage('analyzing')
    try {
      const result = await analyzeFoodPhoto(imageDataUrl, geminiApiKey)
      setProvider(result.provider)
      setItems(
        result.items.map((item) => ({
          ...item,
          id: `${item.name}-${Math.random().toString(36).slice(2, 8)}`,
          included: true,
        })),
      )
      setStage('review')
    } catch (err) {
      const message = err instanceof VisionError ? err.message : 'Something went wrong analyzing this photo'
      setErrorMessage(message)
      setStage('error')
    }
  }

  function updateItem(id: string, patch: Partial<ReviewItem>) {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  const includedItems = items.filter((item) => item.included)
  const totalCalories = includedItems.reduce((sum, item) => sum + item.calories, 0)

  async function handleAddToDiary() {
    if (includedItems.length === 0 || !imageDataUrl) return
    setSaving(true)
    try {
      const thumb = await dataUrlToThumb(imageDataUrl, 128)
      const photoThumbId = await savePhotoThumb(thumb)

      for (const item of includedItems) {
        addEntry({
          date,
          mealType,
          name: item.name.trim() || 'Food item',
          qty: 1,
          unit: item.servingText || 'serving',
          calories: item.calories,
          protein: item.protein,
          carbs: item.carbs,
          fat: item.fat,
          source: 'photo',
          photoThumbId,
        })
      }
      onClose()
    } catch {
      setErrorMessage('Could not save these items — please try again.')
      setStage('error')
    } finally {
      setSaving(false)
    }
  }

  function handleChooseDifferent() {
    setImageDataUrl(null)
    setItems([])
    setStage('pick')
    openPicker()
  }

  return (
    <div className="space-y-4">
      {/* No `capture` attribute: on iOS that would force the camera and hide the
          photo library. Without it, tapping shows the full menu — Take Photo AND
          Choose from Library. */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {stage === 'pick' && (
        <div>
          <button
            type="button"
            onClick={openPicker}
            className="w-full flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-700 py-12 text-slate-300 active:bg-slate-800/50 min-h-[160px]"
          >
            <Camera size={32} className="text-slate-500" />
            <span className="text-sm font-medium">Take or choose a photo</span>
          </button>
          <p className="mt-3 text-center text-xs text-slate-500">
            {geminiApiKey.trim()
              ? 'Analyzed with Gemini AI'
              : 'Demo mode: add a free Gemini API key in Settings for real AI analysis'}
          </p>
        </div>
      )}

      {stage === 'preview' && imageDataUrl && (
        <div className="space-y-3">
          <img
            src={imageDataUrl}
            alt="Selected food"
            className="w-full max-h-64 object-cover rounded-xl"
          />
          <Button variant="primary" full onClick={handleAnalyze}>
            Analyze photo
          </Button>
          <Button variant="ghost" full onClick={handleChooseDifferent}>
            Choose different
          </Button>
        </div>
      )}

      {stage === 'analyzing' && imageDataUrl && (
        <div className="relative">
          <img
            src={imageDataUrl}
            alt="Selected food"
            className="w-full max-h-64 object-cover rounded-xl"
          />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-xl bg-slate-950/60 animate-pulse">
            <Loader2 size={28} className="animate-spin text-primary-400" />
            <span className="text-sm text-slate-200">Identifying food…</span>
          </div>
        </div>
      )}

      {stage === 'review' && (
        <div className="space-y-4">
          {provider === 'mock' && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-300">
              <span className="font-semibold">Sample results — not a real analysis of your photo.</span>{' '}
              Photo mode is in demo mode. Add a free Gemini key in Settings → AI photo analysis to get
              actual macros read from your photo. You can still edit these numbers and log them.
            </div>
          )}
          <p className="text-xs text-slate-400">Tap an item to fix its portion or swap it</p>
          <div className="space-y-2">
            {items.map((item) => {
              const alts = item.alternatives?.length ?? 0
              return (
                <Card key={item.id} className="flex items-center gap-2 p-3">
                  <input
                    type="checkbox"
                    checked={item.included}
                    onChange={(e) => updateItem(item.id, { included: e.target.checked })}
                    className="h-5 w-5 shrink-0 accent-primary-500"
                    aria-label={`Include ${item.name}`}
                  />
                  <button
                    type="button"
                    onClick={() => setRefiningId(item.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-100">{item.name}</span>
                      <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
                        <span className="truncate">
                          {item.servingText} · {Math.round(item.protein)}P {Math.round(item.carbs)}C{' '}
                          {Math.round(item.fat)}F
                        </span>
                        {alts > 0 && (
                          <span className="flex shrink-0 items-center gap-0.5 text-slate-600">
                            <Repeat2 size={10} />
                            {alts}
                          </span>
                        )}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-200">
                      {Math.round(item.calories)}
                    </span>
                    <ChevronRight size={15} className="shrink-0 text-slate-500" />
                  </button>
                </Card>
              )
            })}
          </div>

          <RefineFoodItemSheet
            item={items.find((i) => i.id === refiningId) ?? null}
            onClose={() => setRefiningId(null)}
            onApply={(next) => refiningId && updateItem(refiningId, next)}
          />

          <p className="text-sm text-slate-400">
            Adding {includedItems.length} item{includedItems.length === 1 ? '' : 's'} · {Math.round(totalCalories)} kcal
          </p>

          <div>
            <label className="block text-sm text-slate-400 mb-1">Meal</label>
            <div className="grid grid-cols-4 gap-2">
              {MEAL_TYPES.map((mt) => (
                <button
                  key={mt}
                  type="button"
                  onClick={() => setMealType(mt)}
                  className={`rounded-full py-1.5 text-xs capitalize ${
                    mealType === mt ? 'bg-primary-500 text-slate-950 font-semibold' : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {mt}
                </button>
              ))}
            </div>
          </div>

          <Button
            variant="primary"
            full
            disabled={includedItems.length === 0 || saving}
            onClick={handleAddToDiary}
          >
            {saving ? 'Adding…' : 'Add to diary'}
          </Button>
          <Button variant="ghost" full onClick={handleChooseDifferent}>
            Choose different
          </Button>
        </div>
      )}

      {stage === 'error' && (
        <div className="space-y-3">
          <EmptyState icon={Camera} title="Couldn't analyze photo" subtitle={errorMessage} />
          <Button variant="ghost" full onClick={() => setStage(imageDataUrl ? 'preview' : 'pick')}>
            Try again
          </Button>
          <Button variant="ghost" full onClick={handleChooseDifferent}>
            Choose different
          </Button>
        </div>
      )}
    </div>
  )
}

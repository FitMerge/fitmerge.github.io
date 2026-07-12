import { useEffect, useState } from 'react'
import { getPhotoThumb } from '../../services/photoStore'
import type { FoodEntry } from '../../types'

type FoodEntryRowProps = {
  entry: FoodEntry
  onClick: () => void
}

export default function FoodEntryRow({ entry, onClick }: FoodEntryRowProps) {
  const [thumbUrl, setThumbUrl] = useState<string | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    if (entry.photoThumbId) {
      getPhotoThumb(entry.photoThumbId).then((url) => {
        if (!cancelled) setThumbUrl(url)
      })
    } else {
      setThumbUrl(undefined)
    }
    return () => {
      cancelled = true
    }
  }, [entry.photoThumbId])

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center justify-between gap-3 py-2.5 text-left"
    >
      {thumbUrl && (
        <img
          src={thumbUrl}
          alt=""
          className="w-9 h-9 rounded-lg object-cover shrink-0"
        />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm text-slate-100 truncate">{entry.name}</p>
        <p className="text-xs text-slate-500">
          {/* "g" is a bare unit (200 g); a serving label already describes one
              serving, so only prefix a "×N" when logging more than one. */}
          {entry.unit === 'g'
            ? `${entry.qty} g`
            : entry.qty === 1
              ? entry.unit
              : `${entry.qty} × ${entry.unit}`}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm text-slate-100">{Math.round(entry.calories)} kcal</p>
        <p className="text-xs text-slate-500">
          P {Math.round(entry.protein)} · C {Math.round(entry.carbs)} · F {Math.round(entry.fat)}
        </p>
      </div>
    </button>
  )
}

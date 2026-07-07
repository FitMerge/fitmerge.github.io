import { useMemo } from 'react'
import Card from '../../components/Card'
import MacroBar from '../../components/MacroBar'
import { useNutritionStore, entriesForDate } from '../../store/nutrition'
import { useSettingsStore } from '../../store/settings'
import { lastNDays } from '../../lib/date'
import { sumMacros } from '../../lib/macros'
import { rangeDays, type RangeKey } from './utils'

type MacroAveragesSectionProps = {
  range: RangeKey
}

export default function MacroAveragesSection({ range }: MacroAveragesSectionProps) {
  const entries = useNutritionStore((s) => s.entries)
  const goals = useSettingsStore((s) => s.goals)

  const days = useMemo(() => lastNDays(rangeDays(range)), [range])

  const loggedDayTotals = useMemo(
    () =>
      days
        .map((iso) => entriesForDate(entries, iso))
        .filter((dayEntries) => dayEntries.length > 0)
        .map((dayEntries) => sumMacros(dayEntries)),
    [days, entries],
  )

  const avg = useMemo(() => {
    const n = loggedDayTotals.length
    if (n === 0) return { protein: 0, carbs: 0, fat: 0 }
    const totals = sumMacros(loggedDayTotals)
    return { protein: totals.protein / n, carbs: totals.carbs / n, fat: totals.fat / n }
  }, [loggedDayTotals])

  return (
    <Card>
      <h2 className="text-sm font-semibold text-slate-200 mb-3">Macro averages</h2>
      {loggedDayTotals.length === 0 ? (
        <p className="text-sm text-slate-500 py-2">No meals logged in this range yet.</p>
      ) : (
        <div className="space-y-3">
          <MacroBar label="Protein" value={avg.protein} goal={goals.protein} color="bg-emerald-400" />
          <MacroBar label="Carbs" value={avg.carbs} goal={goals.carbs} color="bg-sky-400" />
          <MacroBar label="Fat" value={avg.fat} goal={goals.fat} color="bg-amber-400" />
          <p className="text-xs text-slate-500">Averaged over {loggedDayTotals.length} logged day(s)</p>
        </div>
      )}
    </Card>
  )
}

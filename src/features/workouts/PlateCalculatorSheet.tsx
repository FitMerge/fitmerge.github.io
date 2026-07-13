import { useEffect, useMemo, useState } from 'react'
import Sheet from '../../components/Sheet'
import NumberField from '../../components/NumberField'
import { useSettingsStore } from '../../store/settings'
import { weightUnitLabel } from './utils'

type PlateCalculatorSheetProps = {
  open: boolean
  onClose: () => void
  /** Seed the target with the weight of the set the user tapped. */
  initialWeight?: number
}

// Standard plate inventories and default bar weights per unit system.
const PLATES_LB = [45, 35, 25, 10, 5, 2.5]
const PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25]

const PLATE_COLOR: Record<number, string> = {
  45: '#ef4444', 25: '#22c55e', 20: '#3b82f6', 35: '#eab308', 15: '#eab308',
  10: '#f8fafc', 5: '#f97316', 2.5: '#a855f7', 1.25: '#64748b',
}

/** Greedily break the per-side load into available plates. Returns null if the
 * target is below the bar weight. Leftover (not divisible) is reported separately. */
function platesPerSide(target: number, bar: number, plates: number[]): { plate: number; count: number }[] | null {
  if (target < bar) return null
  let perSide = (target - bar) / 2
  const out: { plate: number; count: number }[] = []
  for (const p of plates) {
    const count = Math.floor(perSide / p + 1e-9)
    if (count > 0) {
      out.push({ plate: p, count })
      perSide -= count * p
    }
  }
  return out
}

export default function PlateCalculatorSheet({ open, onClose, initialWeight }: PlateCalculatorSheetProps) {
  const units = useSettingsStore((s) => s.units)
  const imperial = units === 'imperial'
  const unit = weightUnitLabel(units)
  const defaultBar = imperial ? 45 : 20
  const plates = imperial ? PLATES_LB : PLATES_KG

  const [target, setTarget] = useState(initialWeight && initialWeight > 0 ? initialWeight : defaultBar)
  const [bar, setBar] = useState(defaultBar)

  // Seed the target from the tapped set each time the sheet is opened (the state
  // above only initialises once, before a weight is known).
  useEffect(() => {
    if (open && initialWeight && initialWeight > 0) setTarget(initialWeight)
  }, [open, initialWeight])

  const result = useMemo(() => platesPerSide(target, bar, plates), [target, bar, plates])
  const loaded = result ? bar + result.reduce((s, r) => s + r.plate * r.count * 2, 0) : bar
  const leftover = Math.round((target - loaded) * 100) / 100

  return (
    <Sheet open={open} onClose={onClose} title="Plate calculator">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Target weight" value={target} onChange={setTarget} step={imperial ? 5 : 2.5} min={0} suffix={unit} />
          <NumberField label="Bar weight" value={bar} onChange={setBar} step={imperial ? 5 : 2.5} min={0} suffix={unit} />
        </div>

        {result === null ? (
          <p className="rounded-lg bg-slate-800/60 p-3 text-center text-sm text-slate-400">
            Target is below the bar weight.
          </p>
        ) : result.length === 0 ? (
          <p className="rounded-lg bg-slate-800/60 p-3 text-center text-sm text-slate-400">
            Just the bar — no plates needed.
          </p>
        ) : (
          <div className="space-y-3">
            <p className="text-center text-xs text-slate-500">Load per side of the bar</p>
            {/* visual: stacked plate chips */}
            <div className="flex items-end justify-center gap-1.5">
              {result.flatMap((r) =>
                Array.from({ length: r.count }, (_, i) => (
                  <div
                    key={`${r.plate}-${i}`}
                    className="flex w-7 items-center justify-center rounded-sm text-[10px] font-bold text-slate-950"
                    style={{
                      height: `${Math.max(28, Math.min(72, 24 + r.plate * (imperial ? 1 : 2)))}px`,
                      background: PLATE_COLOR[r.plate] ?? '#94a3b8',
                    }}
                  >
                    {r.plate}
                  </div>
                )),
              )}
            </div>
            <div className="flex flex-wrap justify-center gap-1.5">
              {result.map((r) => (
                <span key={r.plate} className="rounded-full bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-300">
                  {r.count} × {r.plate}
                </span>
              ))}
            </div>
          </div>
        )}

        {result !== null && leftover > 0.01 && (
          <p className="text-center text-[11px] text-amber-400">
            {leftover} {unit} can&apos;t be matched with standard plates.
          </p>
        )}
      </div>
    </Sheet>
  )
}

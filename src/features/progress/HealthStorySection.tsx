// "What changed" — the top of the Health tab.
//
// Its most important behaviour is saying nothing. On a normal week there is no
// headline, and the card reports that plainly instead of manufacturing a finding
// to justify its own existence. A section that always has something urgent to say
// teaches people to skip it.

import { useMemo, useState } from 'react'
import { ChevronDown, Minus, Sparkles, TrendingDown, TrendingUp } from 'lucide-react'
import Card from '../../components/Card'
import { useHealthStore } from '../../store/health'
import { formatMetric } from '../../lib/healthMetrics'
import { DEFAULT_WINDOWS, healthStory, type Shift } from './healthStory'

export default function HealthStorySection() {
  const days = useHealthStore((s) => s.days)
  const [openDetail, setOpenDetail] = useState(false)
  const story = useMemo(() => healthStory(days), [days])

  const nothing = story.stories.length === 0 && story.looseEnds.length === 0

  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles size={16} className="text-emerald-400" />
        <h2 className="text-sm font-semibold text-slate-200">What changed</h2>
        <span className="ml-auto text-[10px] text-slate-500">
          last {DEFAULT_WINDOWS.fast}d vs prior {DEFAULT_WINDOWS.slow}d
        </span>
      </div>

      {nothing ? (
        <div className="flex items-start gap-2 rounded-xl bg-slate-800/40 p-3">
          <Minus size={14} className="mt-0.5 shrink-0 text-slate-500" />
          <p className="text-xs text-slate-400">
            Nothing has moved outside your usual range. Steady is good — this stays quiet unless
            two or more related metrics shift together.
          </p>
        </div>
      ) : (
        <>
          {story.stories.map((s) => (
            <div
              key={s.theme}
              className={`space-y-2 rounded-xl p-3 ${
                s.improving ? 'bg-emerald-500/10' : 'bg-amber-500/10'
              }`}
            >
              <div className="flex items-start gap-2">
                {s.improving ? (
                  <TrendingUp size={15} className="mt-0.5 shrink-0 text-emerald-400" />
                ) : (
                  <TrendingDown size={15} className="mt-0.5 shrink-0 text-amber-400" />
                )}
                <p className={`text-xs leading-relaxed ${s.improving ? 'text-emerald-200' : 'text-amber-200'}`}>
                  {s.headline}
                </p>
              </div>
              <div className="space-y-1">
                {s.shifts.map((shift) => (
                  <ShiftRow key={shift.key} shift={shift} />
                ))}
              </div>
            </div>
          ))}

          {story.stories.length === 0 && (
            <p className="text-xs text-slate-400">
              A few readings moved, but not enough together to call it a trend.
            </p>
          )}

          {/* Loose ends are real movements that did not earn a headline. Folded
              away so they inform without competing with the actual story. */}
          {story.looseEnds.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setOpenDetail((v) => !v)}
                className="flex w-full items-center justify-between border-t border-slate-800 pt-2.5 text-left"
                aria-expanded={openDetail}
              >
                <span className="text-[11px] font-medium text-slate-400">
                  {story.looseEnds.length} other reading{story.looseEnds.length === 1 ? '' : 's'} moved
                </span>
                <ChevronDown
                  size={14}
                  className={`text-slate-500 transition-transform ${openDetail ? 'rotate-180' : ''}`}
                />
              </button>
              {openDetail && (
                <div className="space-y-1">
                  {story.looseEnds.map((shift) => (
                    <ShiftRow key={shift.key} shift={shift} />
                  ))}
                  <p className="pt-1 text-[10px] leading-relaxed text-slate-500">
                    One metric moving on its own is usually noise, so these are shown without a
                    conclusion attached.
                  </p>
                </div>
              )}
            </>
          )}
        </>
      )}
    </Card>
  )
}

function ShiftRow({ shift }: { shift: Shift }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-slate-900/40 px-2.5 py-1.5">
      <span className="min-w-0 flex-1 truncate text-[11px] text-slate-300">
        {shift.label}
        {/* This number is the window's AVERAGE, not today's reading. Unlabelled it
            read as "today", so a 7,323-step average next to a 17,000-step
            yesterday looked like the app was simply wrong. */}
        <span className="block text-[9px] text-slate-500">{DEFAULT_WINDOWS.fast}-day avg</span>
      </span>
      <span className="shrink-0 text-[11px] font-semibold text-slate-100 tabular-nums">
        {formatMetric(shift.key, shift.fast)}
      </span>
      <span
        className={`w-24 shrink-0 text-right text-[10px] tabular-nums ${
          shift.improving ? 'text-emerald-400' : 'text-amber-400'
        }`}
      >
        {shift.note}
      </span>
    </div>
  )
}

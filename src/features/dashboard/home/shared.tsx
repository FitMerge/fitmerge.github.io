// Shared building blocks for the home-screen layouts: header, insight rows and
// sparkline stat tiles. Kept separate from the layout variants so each variant
// stays pure arrangement.

import type { ComponentType } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BatteryCharging,
  BedDouble,
  BrainCircuit,
  ChevronRight,
  Droplets,
  Dumbbell,
  Flame,
  Pill,
  Scale,
  Settings,
  Trophy,
  UtensilsCrossed,
} from 'lucide-react'
import Sparkline from '../../../components/Sparkline'
import type { Insight, InsightIcon, InsightTone } from '../insights'

export function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export function fmtSleep(min: number): string {
  return `${Math.floor(min / 60)}h ${String(Math.round(min % 60)).padStart(2, '0')}m`
}

export function fmtK(v: number): string {
  return v >= 10_000 ? `${(v / 1000).toFixed(1)}k` : v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}`
}

export const INSIGHT_ICONS: Record<InsightIcon, ComponentType<{ size?: number | string; className?: string }>> = {
  recovery: BatteryCharging,
  sleep: BedDouble,
  training: Dumbbell,
  nutrition: UtensilsCrossed,
  protein: Flame,
  hydration: Droplets,
  weight: Scale,
  streak: Flame,
  supplement: Pill,
  pr: Trophy,
  stress: BrainCircuit,
}

export const TONE_TEXT: Record<InsightTone, string> = {
  good: 'text-emerald-400',
  warn: 'text-amber-400',
  info: 'text-sky-400',
}

export const TONE_BG: Record<InsightTone, string> = {
  good: 'bg-emerald-500/15',
  warn: 'bg-amber-500/15',
  info: 'bg-sky-500/15',
}

export function HomeHeader({ sub }: { sub: string }) {
  const navigate = useNavigate()
  return (
    <header className="flex items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold text-slate-100">{greeting()}</h1>
        <p className="text-sm text-slate-400">{sub}</p>
      </div>
      <button
        type="button"
        onClick={() => navigate('/settings')}
        aria-label="Settings"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-800 text-slate-300 active:bg-slate-700"
      >
        <Settings size={18} />
      </button>
    </header>
  )
}

/** One coaching insight as a tappable row: tone-tinted icon bubble + title + body. */
export function InsightRow({ insight }: { insight: Insight }) {
  const navigate = useNavigate()
  const Icon = INSIGHT_ICONS[insight.icon]
  return (
    <button
      type="button"
      onClick={() => navigate(insight.to)}
      className="flex w-full items-start gap-3 rounded-xl p-1.5 text-left active:bg-slate-800/50"
    >
      <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${TONE_BG[insight.tone]}`}>
        <Icon size={17} className={TONE_TEXT[insight.tone]} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-sm font-semibold ${insight.tone === 'warn' ? 'text-amber-300' : 'text-slate-100'}`}>
          {insight.title}
        </span>
        <span className="block text-xs leading-relaxed text-slate-400">{insight.body}</span>
      </span>
      <ChevronRight size={15} className="mt-1 shrink-0 text-slate-600" />
    </button>
  )
}

type StatTileProps = {
  label: string
  value: string
  unit?: string
  /** Small line under the value — a delta or context read. */
  sub?: string
  subTone?: InsightTone
  spark?: number[]
  sparkColor?: string
  sparkBand?: [number, number]
  sparkBaseline?: number
  /** Bold smoothed trend drawn over a faded raw sparkline. */
  sparkTrend?: number[]
  /** Time window the sparkline covers (e.g. "14 days", "8 weeks") — gives the
   * squiggle a time scale instead of looking like random noise. */
  span?: string
  to?: string
}

/** Compact stat card with an optional sparkline — the grid unit of the home screen. */
export function StatTile({
  label,
  value,
  unit,
  sub,
  subTone,
  spark,
  sparkColor = '#34d399',
  sparkBand,
  sparkBaseline,
  sparkTrend,
  span,
  to,
}: StatTileProps) {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      onClick={() => to && navigate(to)}
      className="flex flex-col items-start rounded-2xl bg-slate-900/80 border border-slate-800/80 p-3 text-left active:bg-slate-800/60"
    >
      <span className="flex w-full items-baseline justify-between">
        <span className="text-[11px] font-medium text-slate-400">{label}</span>
        {span && spark && spark.length >= 2 && <span className="text-[9px] text-slate-600">{span}</span>}
      </span>
      <span className="mt-0.5 text-lg font-bold leading-tight text-slate-100">
        {value}
        {unit && <span className="ml-1 text-xs font-medium text-slate-500">{unit}</span>}
      </span>
      {sub && <span className={`text-[11px] ${subTone ? TONE_TEXT[subTone] : 'text-slate-500'}`}>{sub}</span>}
      {spark && spark.length >= 2 && (
        <Sparkline
          values={spark}
          width={132}
          height={26}
          stroke={sparkColor}
          band={sparkBand}
          baseline={sparkBaseline}
          trend={sparkTrend}
          fill
          className="mt-1.5 w-full"
        />
      )}
    </button>
  )
}

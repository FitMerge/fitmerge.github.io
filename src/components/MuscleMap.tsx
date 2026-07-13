import type { MuscleId } from '../data/muscles'

type Emphasis = 'primary' | 'secondary' | 'none'

type MuscleMapProps = {
  primary?: MuscleId[]
  secondary?: MuscleId[]
  className?: string
}

const NEUTRAL = '#1e293b' // slate-800 — head, hands, feet, joints
const INACTIVE = '#334155' // slate-700 — an un-worked muscle
const PRIMARY = '#34d399' // emerald-400
const SECONDARY = '#0f766e' // teal-700 — assisting muscle

/**
 * A stylized front + back body diagram that highlights the muscles worked by an
 * exercise, in the spirit of Hevy's muscle map. Muscles are keyed by MuscleId so
 * an exercise's primary/secondary arrays light up the matching regions.
 */
export default function MuscleMap({ primary = [], secondary = [], className }: MuscleMapProps) {
  const emphasisOf = (id: MuscleId): Emphasis =>
    primary.includes(id) ? 'primary' : secondary.includes(id) ? 'secondary' : 'none'

  const fill = (id: MuscleId): string => {
    const e = emphasisOf(id)
    return e === 'primary' ? PRIMARY : e === 'secondary' ? SECONDARY : INACTIVE
  }

  return (
    <div className={`flex items-end justify-center gap-4 ${className ?? ''}`}>
      <FigureFront fill={fill} />
      <FigureBack fill={fill} />
    </div>
  )
}

type FillFn = (id: MuscleId) => string

// Shared props for a muscle shape.
const stroke = { stroke: '#0f172a', strokeWidth: 1 } as const

function FigureFront({ fill }: { fill: FillFn }) {
  return (
    <svg viewBox="0 0 120 280" className="h-56 w-auto" role="img" aria-label="Front muscles">
      {/* neutral base: head, neck, hands, feet, pelvis */}
      <circle cx="60" cy="22" r="14" fill={NEUTRAL} />
      <rect x="53" y="34" width="14" height="9" rx="3" fill={NEUTRAL} />
      <path d="M46 138 h28 l-3 16 h-22 z" fill={NEUTRAL} />
      {/* hands */}
      <circle cx="21" cy="120" r="6" fill={NEUTRAL} />
      <circle cx="99" cy="120" r="6" fill={NEUTRAL} />
      {/* feet */}
      <ellipse cx="50" cy="270" rx="7" ry="5" fill={NEUTRAL} />
      <ellipse cx="70" cy="270" rx="7" ry="5" fill={NEUTRAL} />

      {/* delts */}
      <ellipse cx="34" cy="52" rx="11" ry="10" fill={fill('sideDelts')} {...stroke} />
      <ellipse cx="86" cy="52" rx="11" ry="10" fill={fill('sideDelts')} {...stroke} />
      <ellipse cx="40" cy="50" rx="9" ry="8" fill={fill('frontDelts')} {...stroke} />
      <ellipse cx="80" cy="50" rx="9" ry="8" fill={fill('frontDelts')} {...stroke} />

      {/* chest */}
      <path d="M43 58 q8 -5 16 0 v10 q-8 6 -16 0 z" fill={fill('chest')} {...stroke} />
      <path d="M77 58 q-8 -5 -16 0 v10 q8 6 16 0 z" fill={fill('chest')} {...stroke} />

      {/* biceps (upper arm) */}
      <rect x="23" y="62" width="13" height="28" rx="6" fill={fill('biceps')} {...stroke} />
      <rect x="84" y="62" width="13" height="28" rx="6" fill={fill('biceps')} {...stroke} />
      {/* forearms */}
      <rect x="19" y="90" width="12" height="30" rx="5" fill={fill('forearms')} {...stroke} />
      <rect x="89" y="90" width="12" height="30" rx="5" fill={fill('forearms')} {...stroke} />

      {/* obliques */}
      <path d="M44 80 h6 v28 l-6 -4 z" fill={fill('obliques')} {...stroke} />
      <path d="M76 80 h-6 v28 l6 -4 z" fill={fill('obliques')} {...stroke} />
      {/* abs */}
      <rect x="50" y="74" width="20" height="60" rx="5" fill={fill('abs')} {...stroke} />

      {/* quads */}
      <path d="M45 154 q7 -3 13 0 l-2 46 q-5 3 -9 0 z" fill={fill('quads')} {...stroke} />
      <path d="M75 154 q-7 -3 -13 0 l2 46 q5 3 9 0 z" fill={fill('quads')} {...stroke} />
      {/* adductors (inner thigh) */}
      <path d="M57 156 h6 l-1 38 h-4 z" fill={fill('adductors')} {...stroke} />

      {/* calves / shins */}
      <rect x="46" y="206" width="12" height="42" rx="6" fill={fill('calves')} {...stroke} />
      <rect x="62" y="206" width="12" height="42" rx="6" fill={fill('calves')} {...stroke} />
    </svg>
  )
}

function FigureBack({ fill }: { fill: FillFn }) {
  return (
    <svg viewBox="0 0 120 280" className="h-56 w-auto" role="img" aria-label="Back muscles">
      {/* neutral base */}
      <circle cx="60" cy="22" r="14" fill={NEUTRAL} />
      <rect x="53" y="34" width="14" height="9" rx="3" fill={NEUTRAL} />
      <circle cx="21" cy="120" r="6" fill={NEUTRAL} />
      <circle cx="99" cy="120" r="6" fill={NEUTRAL} />
      <ellipse cx="50" cy="270" rx="7" ry="5" fill={NEUTRAL} />
      <ellipse cx="70" cy="270" rx="7" ry="5" fill={NEUTRAL} />

      {/* delts */}
      <ellipse cx="34" cy="52" rx="11" ry="10" fill={fill('sideDelts')} {...stroke} />
      <ellipse cx="86" cy="52" rx="11" ry="10" fill={fill('sideDelts')} {...stroke} />
      <ellipse cx="40" cy="50" rx="9" ry="8" fill={fill('rearDelts')} {...stroke} />
      <ellipse cx="80" cy="50" rx="9" ry="8" fill={fill('rearDelts')} {...stroke} />

      {/* traps */}
      <path d="M48 44 h24 l-4 20 h-16 z" fill={fill('traps')} {...stroke} />

      {/* triceps */}
      <rect x="23" y="62" width="13" height="28" rx="6" fill={fill('triceps')} {...stroke} />
      <rect x="84" y="62" width="13" height="28" rx="6" fill={fill('triceps')} {...stroke} />
      {/* forearms */}
      <rect x="19" y="90" width="12" height="30" rx="5" fill={fill('forearms')} {...stroke} />
      <rect x="89" y="90" width="12" height="30" rx="5" fill={fill('forearms')} {...stroke} />

      {/* upper back */}
      <rect x="47" y="64" width="26" height="16" rx="4" fill={fill('upperBack')} {...stroke} />
      {/* lats */}
      <path d="M47 80 q-6 6 -3 22 l12 -4 v-18 z" fill={fill('lats')} {...stroke} />
      <path d="M73 80 q6 6 3 22 l-12 -4 v-18 z" fill={fill('lats')} {...stroke} />
      {/* lower back */}
      <rect x="52" y="104" width="16" height="24" rx="4" fill={fill('lowerBack')} {...stroke} />

      {/* glutes */}
      <path d="M45 138 q15 -8 30 0 q3 18 -13 18 q-3 0 -4 -2 q-1 2 -4 2 q-16 0 -9 -18 z" fill={fill('glutes')} {...stroke} />
      {/* hamstrings */}
      <path d="M46 160 q6 -3 12 0 l-2 44 q-4 3 -8 0 z" fill={fill('hamstrings')} {...stroke} />
      <path d="M74 160 q-6 -3 -12 0 l2 44 q4 3 8 0 z" fill={fill('hamstrings')} {...stroke} />
      {/* calves */}
      <rect x="46" y="208" width="12" height="42" rx="6" fill={fill('calves')} {...stroke} />
      <rect x="62" y="208" width="12" height="42" rx="6" fill={fill('calves')} {...stroke} />
    </svg>
  )
}

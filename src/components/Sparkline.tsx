type SparklineProps = {
  values: number[]
  width?: number
  height?: number
  stroke?: string
  className?: string
  /** Draw a faint dashed reference line at this value (e.g. the personal baseline). */
  baseline?: number
  /** Shade a "typical range" band [low, high] behind the line. */
  band?: [number, number]
  /** Soft gradient fill under the line. */
  fill?: boolean
  /** Smoothed trend series (same length as values). When set, the raw line fades
   * to a backdrop and this is drawn bold — the same raw-vs-trend read the big
   * charts use. */
  trend?: number[]
}

/**
 * A tiny dependency-free inline-SVG line chart for metric tiles — shows the shape
 * of a trend at a glance without the weight of a full recharts container per tile.
 * Values are oldest→newest; a flat line is drawn when they're all equal. An optional
 * baseline line and typical-range band turn the raw shape into an in/out-of-normal read.
 */
export default function Sparkline({
  values,
  width = 96,
  height = 28,
  stroke = '#34d399',
  className,
  baseline,
  band,
  fill,
  trend,
}: SparklineProps) {
  if (values.length < 2) return <div style={{ width, height }} className={className} />

  // Domain spans the data AND any baseline/band so those references stay visible.
  const domainVals = [...values]
  if (baseline !== undefined) domainVals.push(baseline)
  if (band) domainVals.push(band[0], band[1])
  if (trend) domainVals.push(...trend)
  const min = Math.min(...domainVals)
  const max = Math.max(...domainVals)
  const span = max - min || 1
  const stepX = width / (values.length - 1)
  const pad = 2
  const usable = height - pad * 2
  const y = (v: number) => pad + usable - ((v - min) / span) * usable

  const points = values.map((v, i) => `${(i * stepX).toFixed(1)},${y(v).toFixed(1)}`)
  const lastX = (values.length - 1) * stepX
  const lastY = y(values[values.length - 1])
  const gradId = `sg-${stroke.replace('#', '')}-${Math.round(width)}x${Math.round(height)}`

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={className}
      aria-hidden
    >
      {fill && (
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity={0.28} />
            <stop offset="100%" stopColor={stroke} stopOpacity={0} />
          </linearGradient>
        </defs>
      )}
      {band && (
        <rect
          x={0}
          y={y(band[1])}
          width={width}
          height={Math.max(1, y(band[0]) - y(band[1]))}
          fill="#64748b"
          fillOpacity={0.16}
        />
      )}
      {baseline !== undefined && (
        <line x1={0} y1={y(baseline)} x2={width} y2={y(baseline)} stroke="#64748b" strokeWidth={1} strokeDasharray="3 2" />
      )}
      {fill && (
        <polygon
          points={`0,${(height - pad).toFixed(1)} ${points.join(' ')} ${lastX.toFixed(1)},${(height - pad).toFixed(1)}`}
          fill={`url(#${gradId})`}
        />
      )}
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke={stroke}
        strokeWidth={trend ? 1 : 1.5}
        strokeOpacity={trend ? 0.35 : 1}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {trend && trend.length >= 2 && (
        <polyline
          points={trend.map((v, i) => `${(i * (width / (trend.length - 1))).toFixed(1)},${y(v).toFixed(1)}`).join(' ')}
          fill="none"
          stroke={stroke}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}
      <circle cx={lastX} cy={lastY} r={1.8} fill={stroke} />
    </svg>
  )
}

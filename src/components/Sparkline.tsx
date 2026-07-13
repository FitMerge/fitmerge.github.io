type SparklineProps = {
  values: number[]
  width?: number
  height?: number
  stroke?: string
  className?: string
}

/**
 * A tiny dependency-free inline-SVG line chart for metric tiles — shows the shape
 * of a trend at a glance without the weight of a full recharts container per tile.
 * Values are oldest→newest; a flat line is drawn when they're all equal.
 */
export default function Sparkline({
  values,
  width = 96,
  height = 28,
  stroke = '#34d399',
  className,
}: SparklineProps) {
  if (values.length < 2) return <div style={{ width, height }} className={className} />

  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const stepX = width / (values.length - 1)
  const pad = 2
  const usable = height - pad * 2

  const points = values.map((v, i) => {
    const x = i * stepX
    const y = pad + usable - ((v - min) / span) * usable
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })

  const lastX = (values.length - 1) * stepX
  const lastY = pad + usable - ((values[values.length - 1] - min) / span) * usable

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={className}
      aria-hidden
    >
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={lastX} cy={lastY} r={1.8} fill={stroke} />
    </svg>
  )
}

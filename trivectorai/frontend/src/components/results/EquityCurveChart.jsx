const buildPath = (points, key = "value") => {
  if (!points.length) return ""
  const values = points.map((point) => point[key] || 0)
  const max = Math.max(...values)
  const min = Math.min(...values)
  return points
    .map((point, index) => {
      const x = 20 + (index * 850) / Math.max(points.length - 1, 1)
      const y = 290 - (((point[key] || 0) - min) / Math.max(max - min, 1)) * 270
      return `${index === 0 ? "M" : "L"}${x} ${y}`
    })
    .join(" ")
}

export default function EquityCurveChart({ points = [] }) {
  const clipped = points.slice(-120)
  const strategyPath = buildPath(clipped)
  const benchmarkPath = buildPath(clipped, "benchmark")

  return (
    <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
      <svg viewBox="0 0 900 320" className="h-80 w-full">
        <defs>
          <linearGradient id="fillCurve" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#7f77dd" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#7f77dd" stopOpacity="0.03" />
          </linearGradient>
        </defs>
        <path d={strategyPath} fill="none" stroke="#7f77dd" strokeWidth="3" />
        <path d={`${strategyPath} L870 300 L20 300 Z`} fill="url(#fillCurve)" />
        <path d={benchmarkPath} fill="none" stroke="#9ca3af" strokeDasharray="6 6" strokeWidth="2" />
      </svg>
      <div className="mt-2 flex gap-5 text-xs text-[var(--text-secondary)]">
        <span>Strategy</span>
        <span>Benchmark</span>
      </div>
    </div>
  )
}

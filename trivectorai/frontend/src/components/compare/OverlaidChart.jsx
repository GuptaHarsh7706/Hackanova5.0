import EmptyState from "../ui/EmptyState"

const buildPath = (points, key = "value") => {
  if (!points.length) return ""
  const values = points.map((point) => point[key] || 0)
  const max = Math.max(...values)
  const min = Math.min(...values)
  return points
    .map((point, index) => {
      const x = 20 + (index * 860) / Math.max(points.length - 1, 1)
      const y = 280 - (((point[key] || 0) - min) / Math.max(max - min, 1)) * 240
      return `${index === 0 ? "M" : "L"}${x} ${y}`
    })
    .join(" ")
}

export default function OverlaidChart({ items = [] }) {
  if (items.length < 2) {
    return (
      <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
        <EmptyState title="No chart to compare yet" description="Pick two strategies to render the overlaid equity chart." />
      </div>
    )
  }

  const [a, b] = items
  const pointsA = a.results?.equity_curve?.slice(-60) || []
  const pointsB = b.results?.equity_curve?.slice(-60) || []
  const benchmark = (a.results?.equity_curve || []).slice(-60)

  return (
    <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
      <svg viewBox="0 0 900 320" className="h-72 w-full">
        <path d={buildPath(pointsA)} fill="none" stroke="#7f77dd" strokeWidth="3" />
        <path d={buildPath(pointsB)} fill="none" stroke="#2dd4bf" strokeWidth="3" />
        <path d={buildPath(benchmark, "benchmark")} fill="none" stroke="#9ca3af" strokeDasharray="6 6" strokeWidth="2" />
      </svg>
      <div className="mt-2 flex gap-4 text-xs text-[var(--text-secondary)]">
        <span>{a.name}</span>
        <span>{b.name}</span>
        <span>Benchmark</span>
      </div>
    </div>
  )
}

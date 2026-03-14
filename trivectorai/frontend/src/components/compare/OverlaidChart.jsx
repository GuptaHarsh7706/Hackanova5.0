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
      <div className="cp-panel">
        <EmptyState title="No chart to compare yet" description="Pick two strategies to render the overlaid equity chart." />
      </div>
    )
  }

  const [a, b] = items
  const pointsA = a.results?.equity_curve?.slice(-60) || []
  const pointsB = b.results?.equity_curve?.slice(-60) || []
  const benchmark = (a.results?.equity_curve || []).slice(-60)
  const labelA = a.name || a.strategy?.ticker || "Strategy A"
  const labelB = b.name || b.strategy?.ticker || "Strategy B"

  return (
    <div className="cp-panel cp-chart-panel">
      <div className="cp-head">
        <p>Equity Curve Overlay</p>
      </div>
      <svg viewBox="0 0 900 320" className="cp-chart">
        <path d={buildPath(pointsA)} fill="none" stroke="#00ff9d" strokeWidth="3" />
        <path d={buildPath(pointsB)} fill="none" stroke="#f8bf26" strokeWidth="3" />
        <path d={buildPath(benchmark, "benchmark")} fill="none" stroke="#8fb1d8" strokeDasharray="6 6" strokeWidth="2" />
      </svg>
      <div className="cp-legend">
        <span><i className="line-a" />{labelA}</span>
        <span><i className="line-b" />{labelB}</span>
        <span><i className="line-bm" />Benchmark</span>
      </div>
    </div>
  )
}

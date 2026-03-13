const buildDrawdownPath = (points = []) => {
  if (!points.length) return ""
  const values = points.map((point) => {
    const benchmark = point.benchmark || point.value || 1
    return ((point.value || 0) / benchmark - 1) * 100
  })
  const min = Math.min(...values, -0.1)
  return values
    .map((value, index) => {
      const x = 20 + (index * 860) / Math.max(values.length - 1, 1)
      const y = 80 + (Math.abs(value) / Math.abs(min)) * 200
      return `${index === 0 ? "M" : "L"}${x} ${y}`
    })
    .join(" ")
}

export default function DrawdownChart({ points = [] }) {
  const clipped = points.slice(-120)

  return (
    <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
      <svg viewBox="0 0 900 320" className="h-80 w-full">
        <line x1="20" y1="80" x2="880" y2="80" stroke="#3d3d56" />
        <path d={`${buildDrawdownPath(clipped)} L880 300 L20 300 Z`} fill="#ef444433" stroke="#ef4444" strokeWidth="2" />
      </svg>
    </div>
  )
}

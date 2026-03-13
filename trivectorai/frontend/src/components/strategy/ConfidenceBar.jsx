export default function ConfidenceBar({ score = 0 }) {
  const pct = Math.round(score * 100)
  const tone = pct >= 90 ? "bg-emerald-500" : pct >= 70 ? "bg-amber-500" : "bg-red-500"
  return (
    <div className="space-y-1">
      <div className="h-1.5 w-full rounded-full bg-[var(--bg-elevated)]">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[11px] text-[var(--text-secondary)]">{pct}% confidence</p>
    </div>
  )
}

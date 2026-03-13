export default function AdditionalMetrics({ r }) {
  const rows = [
    ["Avg Win", `${r.avg_win_pct}%`],
    ["Avg Loss", `${r.avg_loss_pct}%`],
    ["Largest Win", `${r.largest_win_pct}%`],
    ["Largest Loss", `${r.largest_loss_pct}%`],
    ["Profit Factor", r.profit_factor],
    ["Expectancy", `$${r.expectancy_usd}/trade`],
  ]

  return (
    <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-3">
      <h3 className="mb-2 text-sm font-semibold">Additional Metrics</h3>
      <div className="space-y-1 text-xs">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between">
            <span className="text-[var(--text-secondary)]">{k}</span>
            <span>{v}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const fmtPct = (v) => (v == null ? "-" : `${Number(v).toFixed(2)}%`)
const fmtUsd = (v) => (v == null ? "-" : `$${Number(v).toFixed(2)}/trade`)

export default function AdditionalMetrics({ metrics = {} }) {
  const rows = [
    ["Avg Win", fmtPct(metrics.avg_win_pct)],
    ["Avg Loss", fmtPct(metrics.avg_loss_pct)],
    ["Largest Win", fmtPct(metrics.largest_win_pct)],
    ["Largest Loss", fmtPct(metrics.largest_loss_pct)],
    ["Profit Factor", metrics.profit_factor ?? "-"],
    ["Expectancy", fmtUsd(metrics.expectancy_usd)],
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

import Badge from "../ui/Badge"
import EmptyState from "../ui/EmptyState"

export default function CompareMetricTable({ items = [] }) {
  if (items.length < 2) {
    return (
      <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-3">
        <EmptyState
          title="Select 2 strategies"
          description="Choose at least two strategies above to unlock side-by-side metrics."
        />
      </div>
    )
  }

  const [a, b] = items
  const left = a.results
  const right = b.results

  const rows = [
    ["Total Return", left.total_return_pct, right.total_return_pct, "high", "%"],
    ["Sharpe Ratio", left.sharpe_ratio, right.sharpe_ratio, "high", ""],
    ["Max Drawdown", left.max_drawdown_pct, right.max_drawdown_pct, "low", "%"],
    ["Win Rate", left.win_rate_pct, right.win_rate_pct, "high", "%"],
    ["Total Trades", left.total_trades, right.total_trades, "na", ""],
    ["CAGR", left.cagr_pct, right.cagr_pct, "high", "%"],
    ["Profit Factor", left.profit_factor, right.profit_factor, "high", ""],
  ]

  const winner = (x, y, mode) => {
    if (mode === "na") return "-"
    if (x === y) return "-"
    if (mode === "low") return x < y ? "A" : "B"
    return x > y ? "A" : "B"
  }

  return (
    <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-3">
      <table className="w-full text-sm">
        <thead className="text-[var(--text-secondary)]">
          <tr>
            <th className="py-2 text-left">Metric</th>
            <th className="text-left">{a.name}</th>
            <th className="text-left">{b.name}</th>
            <th className="text-left">Winner</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([m, x, y, mode, suffix]) => {
            const w = winner(x, y, mode)
            return (
              <tr key={m} className="border-t border-[var(--border-subtle)] text-xs">
                <td className="py-2">{m}</td>
                <td>{x}{suffix}</td>
                <td>{y}{suffix}</td>
                <td>{w === "-" ? "-" : <Badge variant="success">{w}</Badge>}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

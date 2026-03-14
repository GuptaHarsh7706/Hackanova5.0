import Badge from "../ui/Badge"
import EmptyState from "../ui/EmptyState"

const toNum = (value, fallback = 0) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

export default function CompareMetricTable({ items = [] }) {
  if (items.length < 2) {
    return (
      <div className="cp-panel">
        <EmptyState
          title="Select 2 strategies"
          description="Choose at least two strategies above to unlock side-by-side metrics."
        />
      </div>
    )
  }

  const [a, b] = items
  const left = a.results || {}
  const right = b.results || {}

  const rows = [
    ["Total Return", toNum(left.total_return_pct), toNum(right.total_return_pct), "high", "%"],
    ["Sharpe Ratio", toNum(left.sharpe_ratio), toNum(right.sharpe_ratio), "high", ""],
    ["Max Drawdown", toNum(left.max_drawdown_pct), toNum(right.max_drawdown_pct), "low", "%"],
    ["Win Rate", toNum(left.win_rate_pct ?? left.win_rate), toNum(right.win_rate_pct ?? right.win_rate), "high", "%"],
    ["Total Trades", toNum(left.total_trades), toNum(right.total_trades), "na", ""],
    ["CAGR", toNum(left.cagr_pct), toNum(right.cagr_pct), "high", "%"],
    ["Profit Factor", toNum(left.profit_factor), toNum(right.profit_factor), "high", ""],
  ]

  const winner = (x, y, mode) => {
    if (mode === "na") return "-"
    if (x === y) return "-"
    if (mode === "low") return x < y ? "A" : "B"
    return x > y ? "A" : "B"
  }

  return (
    <div className="cp-panel cp-table-panel">
      <div className="cp-head">
        <p>Performance Metrics Matrix</p>
      </div>
      <table className="cp-table">
        <thead>
          <tr>
            <th>Metric</th>
            <th>{a.name}</th>
            <th>{b.name}</th>
            <th>Winner</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([m, x, y, mode, suffix]) => {
            const w = winner(x, y, mode)
            return (
              <tr key={m}>
                <td>{m}</td>
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

import MetricCard from "./MetricCard"

export default function MetricsStrip({ results }) {
  const cards = [
    ["Total Return", `${results.total_return_pct}%`, "vs benchmark", "good"],
    ["Sharpe Ratio", results.sharpe_ratio, "risk adjusted", "good"],
    ["Max Drawdown", `${results.max_drawdown_pct}%`, "peak to trough", "bad"],
    ["Win Rate", `${results.win_rate_pct}%`, "winning trades", "good"],
    ["Total Trades", results.total_trades, "executed", "neutral"],
    ["CAGR", `${results.cagr_pct}%`, "annualized", "good"],
  ]

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {cards.map(([label, value, sub, tone]) => (
        <MetricCard key={label} label={label} value={value} sub={sub} tone={tone} />
      ))}
    </div>
  )
}

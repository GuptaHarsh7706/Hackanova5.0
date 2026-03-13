import MetricCard from "./MetricCard"

const METRIC_CONFIG = [
  { key: "total_return_pct", label: "Total Return", suffix: "%", positive: (v) => v > 0 },
  { key: "sharpe_ratio", label: "Sharpe Ratio", suffix: "", positive: (v) => v > 1 },
  { key: "max_drawdown_pct", label: "Max Drawdown", suffix: "%", positive: (v) => v > -20 },
  { key: "win_rate_pct", label: "Win Rate", suffix: "%", positive: (v) => v > 50 },
  { key: "total_trades", label: "Total Trades", suffix: "", positive: () => true },
  { key: "cagr_pct", label: "CAGR", suffix: "%", positive: (v) => v > 0 },
]

export default function MetricsStrip({ metrics }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {METRIC_CONFIG.map((cfg) => {
        const value = metrics?.[cfg.key]
        const display = value == null ? "-" : `${value}${cfg.suffix}`
        return (
          <MetricCard
            key={cfg.key}
            label={cfg.label}
            value={display}
            tone={cfg.positive(value) ? "good" : "bad"}
          />
        )
      })}
    </div>
  )
}

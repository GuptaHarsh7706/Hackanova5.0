import { MoreHorizontal, Star } from "lucide-react"
import { Link } from "react-router-dom"

import Card from "../ui/Card"

export default function HistoryCard({ item }) {
  const result = item.results || {}
  const sparkline = result.equity_curve?.slice(-12) || []
  const maxValue = Math.max(...sparkline.map((point) => point.value), 1)
  const minValue = Math.min(...sparkline.map((point) => point.value), maxValue)
  const path = sparkline
    .map((point, index) => {
      const x = 2 + (index * 108) / Math.max(sparkline.length - 1, 1)
      const y = 28 - ((point.value - minValue) / Math.max(maxValue - minValue, 1)) * 22
      return `${index === 0 ? "M" : "L"}${x} ${y}`
    })
    .join(" ")

  return (
    <Link to={`/app/results/${item.id}`} state={{ result: result }}>
      <Card hoverable className="p-3">
      <div className="mb-2 flex items-start justify-between">
        <div>
          <p className="text-xs text-[var(--text-secondary)]">
            {item.ticker} - {item.timeframe} - {item.asset_class}
          </p>
          <p className="text-sm font-semibold">{item.name}</p>
        </div>
        <div className="flex items-center gap-2">
          {item.favorited ? <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" /> : null}
          <MoreHorizontal className="h-4 w-4 text-[var(--text-secondary)]" />
        </div>
      </div>
      <div className="mb-2 grid grid-cols-4 gap-2 text-[11px]">
        <span className="text-emerald-300">{result.total_return_pct ?? 0}%</span>
        <span>{result.sharpe_ratio ?? 0}</span>
        <span className="text-red-300">-{result.max_drawdown_pct ?? 0}%</span>
        <span>{result.win_rate_pct ?? 0}%</span>
      </div>
      <svg viewBox="0 0 120 32" className="mb-2 h-8 w-full">
        <path d={path || "M2 28 L15 24 L28 22 L42 18 L60 14 L78 16 L94 10 L110 6"} fill="none" stroke="#7f77dd" strokeWidth="2" />
      </svg>
      <p className="text-xs text-[var(--text-secondary)]">{item.entry_rules?.[0]?.indicator}(...) x ...</p>
      <p className="mt-2 text-[11px] text-[var(--text-muted)]">{new Date(item.created_at).toLocaleDateString()} - {result.total_trades ?? 0} trades</p>
      {item.in_progress ? <div className="mt-2 text-xs text-amber-300">In Progress...</div> : null}
      </Card>
    </Link>
  )
}

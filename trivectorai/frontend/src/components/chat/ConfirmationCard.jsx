import Button from "../ui/Button"
import Card from "../ui/Card"

export default function ConfirmationCard({ strategy, onRunBacktest }) {
  if (!strategy) return null

  return (
    <Card className="mt-2 p-3" active>
      <div className="mb-2 flex items-center justify-between text-sm">
        <p className="font-semibold text-emerald-300">Strategy Parsed</p>
        <span className="text-xs text-[var(--text-secondary)]">{Math.round((strategy.confidence_score || 1) * 100)}% conf</span>
      </div>
      <p className="mb-2 text-xs text-[var(--text-secondary)]">
        {strategy.ticker || "-"} - {strategy.timeframe || "-"} - {strategy.asset_class || "-"}
      </p>
      <div className="space-y-1 text-xs">
        <p>
          <span className="text-[var(--text-muted)]">Entry: </span>
          {strategy.entry_rules?.[0]?.indicator} {strategy.entry_rules?.[0]?.condition}
        </p>
        <p>
          <span className="text-[var(--text-muted)]">Exit: </span>
          {strategy.exit_rules?.[0]?.indicator || "Not specified"}
        </p>
      </div>
      <div className="mt-3 flex gap-2">
        <Button size="sm" onClick={onRunBacktest}>
          Run Backtest
        </Button>
        <Button size="sm" variant="ghost">
          Edit Strategy
        </Button>
      </div>
    </Card>
  )
}

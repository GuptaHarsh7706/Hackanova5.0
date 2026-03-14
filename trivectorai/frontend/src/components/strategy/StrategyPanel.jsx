import { FileJson } from "lucide-react"
import { useNavigate } from "react-router-dom"

import { useStrategyStore } from "../../store/useStrategyStore"
import Badge from "../ui/Badge"
import Button from "../ui/Button"
import EmptyState from "../ui/EmptyState"
import ConfidenceBar from "./ConfidenceBar"
import MissingFieldAlert from "./MissingFieldAlert"
import RuleCard from "./RuleCard"

export default function StrategyPanel({ onRunBacktest }) {
  const navigate = useNavigate()
  const strategy        = useStrategyStore((s) => s.currentStrategy)
  const parseStatus     = useStrategyStore((s) => s.parseStatus)
  const missingFields   = useStrategyStore((s) => s.missingFields)
  const backtestLoading = useStrategyStore((s) => s.backtestLoading)

  if (!strategy) return <EmptyState icon={FileJson} title="No strategy parsed yet" description="Start chatting to see your strategy appear here." />

  return (
    <aside className="h-full w-[380px] animate-panel-slide bg-transparent p-3">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold">Parsed Strategy</p>
        <div className="flex gap-1">
          <button className="rounded-md p-1 hover:bg-[var(--bg-elevated)]" onClick={() => navigate("/app")}>Back</button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="brand">{strategy.ticker || "-"}</Badge>
          <Badge>{strategy.timeframe || "-"}</Badge>
          <Badge>{strategy.asset_class || "-"}</Badge>
        </div>

        <ConfidenceBar score={strategy.confidence_score || 0} />

        <section className="space-y-2">
          <p className="micro text-[var(--text-muted)]">Entry Conditions</p>
          {strategy.entry_rules?.map((r, idx) => (
            <RuleCard key={`e-${idx}`} rule={r} />
          ))}
        </section>

        <section className="space-y-2">
          <p className="micro text-[var(--text-muted)]">Exit Conditions</p>
          {strategy.exit_rules?.length ? strategy.exit_rules.map((r, idx) => <RuleCard key={`x-${idx}`} rule={r} />) : <p className="text-xs text-[var(--text-secondary)]">Not specified</p>}
        </section>

        <section className="space-y-2 text-xs">
          <p className="micro text-[var(--text-muted)]">Risk Parameters</p>
          <p>Stop Loss: {strategy.stop_loss_pct ?? "-"}%</p>
          <p>Take Profit: {strategy.take_profit_pct ?? "-"}%</p>
          <p>Position Size: {Math.round((strategy.position_size || 0) * 100)}%</p>
        </section>

        <MissingFieldAlert fields={missingFields} />

        <Button className="w-full" onClick={onRunBacktest} disabled={!strategy?.ticker || backtestLoading || parseStatus !== "ok" || (missingFields && missingFields.length > 0)}>
          {backtestLoading ? "Running..." : "Run Backtest →"}
        </Button>
      </div>
    </aside>
  )
}

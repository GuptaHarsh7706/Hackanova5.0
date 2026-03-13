import { useMemo, useState } from "react"
import { ArrowLeft } from "lucide-react"
import { Link, useLocation, useParams } from "react-router-dom"

import { normalizeBacktestResult } from "../api/strategyApi"
import AdditionalMetrics from "../components/results/AdditionalMetrics"
import AIInsightPanel from "../components/results/AIInsightPanel"
import DrawdownChart from "../components/results/DrawdownChart"
import EquityCurveChart from "../components/results/EquityCurveChart"
import MetricsStrip from "../components/results/MetricsStrip"
import MonthlyHeatmap from "../components/results/MonthlyHeatmap"
import TradeLogTable from "../components/results/TradeLogTable"
import Button from "../components/ui/Button"
import Card from "../components/ui/Card"
import EmptyState from "../components/ui/EmptyState"
import { useStrategyStore } from "../store/useStrategyStore"

export default function ResultsPage() {
  const location = useLocation()
  const { id } = useParams()
  const [tab, setTab] = useState("equity")
  const currentBacktestResult = useStrategyStore((s) => s.currentBacktestResult)
  const history = useStrategyStore((s) => s.history)

  const sourceResult = useMemo(() => {
    if (location.state?.result?.strategy_id === id) return location.state.result
    if (currentBacktestResult?.strategy_id === id) return currentBacktestResult
    const historyMatch = history.find((item) => item.id === id)
    return historyMatch?.results || null
  }, [currentBacktestResult, history, id, location.state])

  const result = useMemo(() => normalizeBacktestResult(sourceResult), [sourceResult])
  const strategy = result?.strategy || null

  if (!result || !strategy) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        <EmptyState title="No result loaded" description="Run a backtest from chat or open a result from history." />
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/app" className="mb-1 inline-flex items-center gap-1 text-xs text-[var(--text-secondary)]">
            <ArrowLeft className="h-3 w-3" /> Back to Chat
          </Link>
          <h2 className="text-2xl font-semibold">{strategy.ticker} - {strategy.name || "Backtest"}</h2>
          <p className="text-sm text-[var(--text-secondary)]">{strategy.timeframe} chart - {strategy.asset_class} - {result.data_period}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm">Share</Button>
          <Button variant="secondary" size="sm">Export PDF</Button>
          <Button size="sm">Save</Button>
        </div>
      </div>

      <MetricsStrip results={result} />

      <div className="space-y-3">
        <div className="flex gap-2">
          <Button variant={tab === "equity" ? "primary" : "secondary"} size="sm" onClick={() => setTab("equity")}>Equity Curve</Button>
          <Button variant={tab === "drawdown" ? "primary" : "secondary"} size="sm" onClick={() => setTab("drawdown")}>Drawdown Chart</Button>
        </div>
        {tab === "equity" ? <EquityCurveChart points={result.equity_curve} /> : <DrawdownChart points={result.equity_curve} />}
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <div className="space-y-4 xl:col-span-3">
          <TradeLogTable trades={result.trades} />
        </div>
        <div className="space-y-4 xl:col-span-2">
          <Card className="p-3">
            <h3 className="mb-2 text-sm font-semibold">Strategy Details</h3>
            <div className="space-y-1 text-xs text-[var(--text-secondary)]">
              <p>Asset: {strategy.ticker}</p>
              <p>Timeframe: {strategy.timeframe}</p>
              <p>Entry: {strategy.entry_rules?.map((rule) => `${rule.indicator} ${rule.condition}`).join(" AND ") || "Not specified"}</p>
              <p>Exit: {strategy.exit_rules?.length ? strategy.exit_rules.map((rule) => `${rule.indicator} ${rule.condition}`).join(" AND ") : "Not specified"}</p>
              <p>Stop Loss: {strategy.stop_loss_pct ?? "-"}%</p>
            </div>
          </Card>
          <MonthlyHeatmap data={result.monthly_returns} />
          <AdditionalMetrics r={result} />
        </div>
      </div>

      <AIInsightPanel narrative={result.ai_narrative} />
    </div>
  )
}

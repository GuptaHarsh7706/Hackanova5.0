import { useEffect, useMemo, useState } from "react"
import { ArrowLeft } from "lucide-react"
import { useNavigate, useParams } from "react-router-dom"

import AdditionalMetrics from "../components/results/AdditionalMetrics"
import AIInsightPanel from "../components/results/AIInsightPanel"
import EquityCurveChart from "../components/results/EquityCurveChart"
import MetricsStrip from "../components/results/MetricsStrip"
import MonthlyHeatmap from "../components/results/MonthlyHeatmap"
import TradeLogTable from "../components/results/TradeLogTable"
import Button from "../components/ui/Button"
import Card from "../components/ui/Card"
import EmptyState from "../components/ui/EmptyState"
import { useStrategyStore } from "../store/useStrategyStore"

export default function ResultsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const {
    backtestResult,
    currentResultId,
    backtestLoading,
    fetchResultById,
  } = useStrategyStore()

  useEffect(() => {
    if (!backtestResult || currentResultId !== id) {
      fetchResultById(id)
    }
  }, [id])

  if (backtestLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="mb-2 text-lg font-semibold">Loading results...</div>
          <div className="text-sm text-[var(--text-secondary)]">Hang tight, this can take a few seconds.</div>
        </div>
      </div>
    )
  }

  if (!backtestResult) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        <EmptyState title="Result not found" action={{ label: "← Back", onClick: () => navigate("/app") }} />
      </div>
    )
  }

  const { metrics, equity_curve, trades, monthly_returns, ai_narrative, strategy, data_period } = backtestResult

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="mb-1 inline-flex items-center gap-1 text-xs text-[var(--text-secondary)] cursor-pointer" onClick={() => navigate("/app") }>
            <ArrowLeft className="h-3 w-3" /> Back to Chat
          </div>
          <h2 className="text-2xl font-semibold">{strategy?.ticker} - {strategy?.name || "Backtest"}</h2>
          <p className="text-sm text-[var(--text-secondary)]">{strategy?.timeframe} chart - {strategy?.asset_class} - {data_period}</p>
        </div>
      </div>

      <MetricsStrip metrics={metrics} />

      <div className="grid gap-4 xl:grid-cols-5">
        <div className="space-y-4 xl:col-span-3">
          <EquityCurveChart data={equity_curve} strategy={strategy} />
          <TradeLogTable trades={trades} />
        </div>
        <div className="space-y-4 xl:col-span-2">
          <Card className="p-3">
            <h3 className="mb-2 text-sm font-semibold">Strategy Details</h3>
            <div className="space-y-1 text-xs text-[var(--text-secondary)]">
              <p>Asset: {strategy?.ticker}</p>
              <p>Timeframe: {strategy?.timeframe}</p>
              <p>Entry: {strategy?.entry_rules?.map((rule) => `${rule.indicator} ${rule.condition}`).join(" AND ") || "Not specified"}</p>
              <p>Exit: {strategy?.exit_rules?.length ? strategy.exit_rules.map((rule) => `${rule.indicator} ${rule.condition}`).join(" AND ") : "Not specified"}</p>
              <p>Stop Loss: {strategy?.stop_loss_pct ?? "-"}%</p>
            </div>
          </Card>
          <MonthlyHeatmap data={monthly_returns} />
          <AdditionalMetrics metrics={metrics} />
        </div>
      </div>

      <AIInsightPanel narrative={ai_narrative} />
    </div>
  )
}

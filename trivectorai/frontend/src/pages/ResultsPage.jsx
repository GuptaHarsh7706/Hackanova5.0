import { useEffect, useMemo } from "react"
import { ArrowLeft, Bell, CircleUser, Download, RefreshCcw } from "lucide-react"
import { useNavigate, useParams } from "react-router-dom"

import EmptyState from "../components/ui/EmptyState"
import { useStrategyStore } from "../store/useStrategyStore"

const fmtPct = (v, digits = 2) => (v == null ? "-" : `${Number(v).toFixed(digits)}%`)
const fmtNum = (v, digits = 2) => (v == null ? "-" : Number(v).toFixed(digits))

const downloadTextFile = (filename, content, mime = "text/plain") => {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

const pointsFromValues = (values = [], width = 100, height = 38) => {
  if (!values.length) return ""
  const min = Math.min(...values)
  const max = Math.max(...values)
  return values
    .map((v, i) => {
      const x = (i * width) / Math.max(values.length - 1, 1)
      const y = height - ((v - min) / Math.max(max - min, 1)) * (height - 3) - 1.5
      return `${x},${y}`
    })
    .join(" ")
}

const fillPolygonPoints = (values = [], width = 100, height = 32, baseline = 31) => {
  const line = pointsFromValues(values, width, height)
  if (!line) return ""
  return `${line} ${width},${baseline} 0,${baseline}`
}

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

  const result = backtestResult || {}
  const metrics = result.metrics || {}
  const equity_curve = result.equity_curve || []
  const trades = result.trades || []
  const monthly_returns = result.monthly_returns || {}
  const ai_narrative = result.ai_narrative
  const strategy = result.strategy || {}
  const data_period = result.data_period

  const equity = useMemo(() => equity_curve.slice(-140), [equity_curve])
  const equityValues = equity.map((x) => Number(x.value || 0))
  const benchmarkValues = equity.map((x) => Number(x.benchmark || 0))

  const drawdownValues = useMemo(() => {
    if (!equityValues.length) return []
    let peak = equityValues[0]
    return equityValues.map((v) => {
      peak = Math.max(peak, v)
      return peak ? ((v - peak) / peak) * 100 : 0
    })
  }, [equityValues])

  const distribution = useMemo(() => {
    const values = trades.map((t) => Number(t.return_pct ?? t.pnl_pct ?? 0)).filter((n) => Number.isFinite(n))
    if (!values.length) return Array.from({ length: 8 }, () => 0)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const bins = Array.from({ length: 8 }, () => 0)
    values.forEach((v) => {
      const idx = Math.min(7, Math.floor(((v - min) / Math.max(max - min, 1)) * 8))
      bins[idx] += 1
    })
    return bins
  }, [trades])

  const topTrades = useMemo(() => {
    const ranked = [...trades].sort((a, b) => Number(b.pnl_usd || 0) - Number(a.pnl_usd || 0))
    return ranked.slice(0, 6)
  }, [trades])

  if (backtestLoading) {
    return (
      <div className="rt-page flex h-full items-center justify-center">
        <div className="text-center">
          <div className="mb-2 text-lg font-semibold">Loading results...</div>
          <div className="text-sm text-[var(--text-secondary)]">Hang tight, this can take a few seconds.</div>
        </div>
      </div>
    )
  }

  if (!backtestResult) {
    return (
      <div className="rt-page space-y-4 p-4 md:p-6">
        <EmptyState title="Result not found" action={{ label: "← Back", onClick: () => navigate("/app") }} />
      </div>
    )
  }

  const riskRows = [
    ["Volatility (Annualized)", fmtPct(metrics?.volatility_annual_pct)],
    ["Value at Risk (95%)", fmtPct(metrics?.var_95_pct)],
    ["Conditional VaR", fmtPct(metrics?.cvar_95_pct)],
    ["Beta vs Benchmark", fmtNum(metrics?.beta)],
    ["Correlation", fmtNum(metrics?.correlation)],
    ["Information Ratio", fmtNum(metrics?.information_ratio)],
  ]

  const tradeRows = [
    ["Total Trades", metrics?.total_trades ?? trades.length ?? 0],
    ["Winning Trades", metrics?.winning_trades ?? trades.filter((t) => Number(t.pnl_usd || 0) > 0).length],
    ["Losing Trades", metrics?.losing_trades ?? trades.filter((t) => Number(t.pnl_usd || 0) < 0).length],
    ["Win Rate", fmtPct(metrics?.win_rate_pct ?? metrics?.win_rate)],
    ["Profit Factor", fmtNum(metrics?.profit_factor)],
    ["Avg Trade Duration", metrics?.avg_trade_days ? `${fmtNum(metrics.avg_trade_days)} days` : "-"],
  ]

  const monthEntries = Object.entries(monthly_returns)
  const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

  const reportMarkdown = useMemo(() => {
    return [
      "# Backtest Report",
      "",
      "## Strategy Summary",
      `- Ticker: ${strategy?.ticker || "N/A"}`,
      `- Timeframe: ${strategy?.timeframe || "N/A"}`,
      `- Data Period: ${data_period || "N/A"}`,
      "",
      "## Performance Metrics",
      `- Total Return: ${fmtPct(metrics?.total_return_pct)}`,
      `- Annualized Return (CAGR): ${fmtPct(metrics?.cagr_pct)}`,
      `- Sharpe Ratio: ${fmtNum(metrics?.sharpe_ratio)}`,
      `- Sortino Ratio: ${fmtNum(metrics?.sortino_ratio)}`,
      `- Max Drawdown: ${fmtPct(metrics?.max_drawdown_pct)}`,
      `- Profit Factor: ${fmtNum(metrics?.profit_factor)}`,
      "",
      "## Trade Statistics",
      `- Total Trades: ${metrics?.total_trades ?? 0}`,
      `- Win Rate: ${fmtPct(metrics?.win_rate_pct ?? metrics?.win_rate)}`,
      `- Avg Win: ${fmtPct(metrics?.avg_win_pct)}`,
      `- Avg Loss: ${fmtPct(metrics?.avg_loss_pct)}`,
      `- Largest Win: ${fmtPct(metrics?.largest_win_pct)}`,
      `- Largest Loss: ${fmtPct(metrics?.largest_loss_pct)}`,
      "",
      "## AI Narrative",
      ai_narrative || "No narrative available.",
      "",
      `Generated At: ${new Date().toISOString()}`,
    ].join("\n")
  }, [strategy?.ticker, strategy?.timeframe, data_period, metrics, ai_narrative])

  const onExportReport = () => {
    const ticker = (strategy?.ticker || "strategy").toLowerCase()
    const stamp = new Date().toISOString().slice(0, 10)
    downloadTextFile(`${ticker}-backtest-report-${stamp}.md`, reportMarkdown, "text/markdown")
  }

  const onExportRawJson = () => {
    const ticker = (strategy?.ticker || "strategy").toLowerCase()
    const stamp = new Date().toISOString().slice(0, 10)
    downloadTextFile(`${ticker}-backtest-result-${stamp}.json`, JSON.stringify(result, null, 2), "application/json")
  }

  const metricCards = [
    ["Total Return", fmtPct(metrics?.total_return_pct), Number(metrics?.total_return_pct ?? 0) >= 0],
    ["Sharpe Ratio", fmtNum(metrics?.sharpe_ratio), Number(metrics?.sharpe_ratio ?? 0) >= 0],
    ["Sortino Ratio", fmtNum(metrics?.sortino_ratio), Number(metrics?.sortino_ratio ?? 0) >= 0],
    ["Max Drawdown", fmtPct(metrics?.max_drawdown_pct), Number(metrics?.max_drawdown_pct ?? 0) >= -10],
    ["Win Rate", fmtPct(metrics?.win_rate_pct ?? metrics?.win_rate), Number(metrics?.win_rate_pct ?? metrics?.win_rate ?? 0) >= 50],
    ["Profit Factor", fmtNum(metrics?.profit_factor), Number(metrics?.profit_factor ?? 0) >= 1],
  ]

  return (
    <div className="rt-page">
      <header className="rt-topbar">
        <div className="rt-brand">AI Trading Platform</div>
        <h1>Backtest Results</h1>
        <div className="rt-tools">
          <button>{strategy?.timeframe || "1H"}</button>
          <button onClick={onExportRawJson}><Download className="h-3.5 w-3.5" /> Export JSON</button>
          <Bell className="h-3.5 w-3.5" />
          <CircleUser className="h-3.5 w-3.5" />
        </div>
      </header>

      <main className="rt-content">
        <section className="rt-metric-strip">
          {metricCards.map(([label, value, good]) => (
            <article key={label} className={`rt-metric-card ${good ? "good" : "bad"}`}>
              <p>{label}</p>
              <strong>{value}</strong>
            </article>
          ))}
        </section>

        <section className="rt-panel">
          <div className="rt-panel-head"><p>How To Read These Metrics</p></div>
          <div className="rt-kv-list">
            <div><span>Total Return</span><b>Net portfolio growth over the full backtest period.</b></div>
            <div><span>Sharpe / Sortino</span><b>Risk-adjusted return quality (higher is generally better).</b></div>
            <div><span>Max Drawdown</span><b>Largest peak-to-trough portfolio decline.</b></div>
            <div><span>Profit Factor</span><b>Gross profits divided by gross losses.</b></div>
            <div><span>Win Rate</span><b>Percentage of trades that closed profitably.</b></div>
          </div>
        </section>

        <section className="rt-panel rt-equity">
          <div className="rt-panel-head">
            <p>Equity Curve - Strategy vs Benchmark</p>
            <span>{strategy?.ticker || "Strategy"} · {data_period || "Period"}</span>
          </div>
          <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="rt-equity-svg">
            <polyline fill="none" stroke="#00ff9d" strokeWidth="0.7" points={pointsFromValues(equityValues)} />
            <polyline fill="none" stroke="#f8bf26" strokeWidth="0.5" strokeDasharray="1.2 1.2" points={pointsFromValues(benchmarkValues)} />
          </svg>
          <div className="mt-2 flex gap-5 text-[10px] text-[var(--text-secondary)]">
            <span className="inline-flex items-center gap-1"><i className="inline-block h-0.5 w-4 bg-[#00ff9d]" /> Strategy Equity</span>
            <span className="inline-flex items-center gap-1"><i className="inline-block h-0.5 w-4 bg-[#f8bf26]" /> Benchmark</span>
          </div>
        </section>

        <section className="rt-row2">
          <article className="rt-panel">
            <div className="rt-panel-head"><p>Drawdown Analysis</p></div>
            <svg viewBox="0 0 100 32" preserveAspectRatio="none" className="rt-dd-svg">
              <polyline fill="none" stroke="#ff2f73" strokeWidth="0.65" points={pointsFromValues(drawdownValues, 100, 32)} />
              <polygon
                points={fillPolygonPoints(drawdownValues, 100, 32, 31)}
                fill="rgba(255, 47, 115, 0.25)"
              />
            </svg>
          </article>

          <article className="rt-panel">
            <div className="rt-panel-head"><p>Trade Distribution</p></div>
            <div className="rt-dist-bars">
              {distribution.map((h, idx) => (
                <span key={idx} style={{ height: `${8 + h * 12}px` }} />
              ))}
            </div>
          </article>
        </section>

        <section className="rt-panel">
          <div className="rt-panel-head"><p>Monthly Returns Heatmap</p></div>
          <div className="rt-heatmap">
            <div />
            {monthLabels.map((m) => <span key={m} className="h-label">{m}</span>)}
            {monthEntries.map(([year, vals]) => (
              <div key={year} className="rt-heatmap-row">
                <span className="y-label">{year}</span>
                {vals.map((v, i) => (
                  <span
                    key={`${year}-${i}`}
                    className={`cell ${v >= 0 ? "pos" : "neg"}`}
                    style={{ opacity: Math.min(1, 0.2 + Math.abs(Number(v || 0)) / 12) }}
                    title={`${year} ${monthLabels[i]}: ${Number(v).toFixed(2)}%`}
                  />
                ))}
              </div>
            ))}
          </div>
        </section>

        <section className="rt-bottom-grid">
          <article className="rt-panel">
            <div className="rt-panel-head"><p>Risk Analytics</p></div>
            <div className="rt-kv-list">
              {riskRows.map(([k, v]) => (
                <div key={k}><span>{k}</span><b>{v}</b></div>
              ))}
            </div>
          </article>

          <article className="rt-panel">
            <div className="rt-panel-head"><p>Trade Statistics</p></div>
            <div className="rt-kv-list">
              {tradeRows.map(([k, v]) => (
                <div key={k}><span>{k}</span><b>{v}</b></div>
              ))}
            </div>
          </article>

          <article className="rt-panel">
            <div className="rt-panel-head"><p>Top Performers</p></div>
            <div className="rt-kv-list">
              {topTrades.length ? topTrades.map((t, idx) => (
                <div key={`${t.id || idx}-${idx}`}>
                  <span>{t.symbol || `Trade ${t.id ?? idx + 1}`}</span>
                  <b className={Number(t.pnl_usd || 0) >= 0 ? "up" : "down"}>{fmtPct(t.return_pct || 0)}</b>
                </div>
              )) : <div><span>No trade list available</span><b>-</b></div>}
            </div>
          </article>
        </section>

        <footer className="rt-footer-actions">
          <div className="left-note">{ai_narrative ? ai_narrative.slice(0, 160) : "Past performance is not indicative of future results. Use caution."}</div>
          <div className="actions">
            <button onClick={() => navigate(`/app/trade-analytics/${id}`)}>Trade Analytics</button>
            <button onClick={() => navigate("/app/backtests")}>Modify Parameters</button>
            <button onClick={() => navigate("/app/strategy-lab")}><RefreshCcw className="h-3 w-3" /> Run New Backtest</button>
            <button onClick={onExportReport}>Export Report</button>
          </div>
        </footer>
      </main>

      <div className="rt-bottom-status">
        <button className="ghost-link" onClick={() => navigate("/app/strategy-lab")}><ArrowLeft className="h-3 w-3" /> Back to Strategy Lab</button>
        <span className="up">● Ready for next run</span>
        <span>{new Date().toLocaleString()}</span>
      </div>
    </div>
  )
}

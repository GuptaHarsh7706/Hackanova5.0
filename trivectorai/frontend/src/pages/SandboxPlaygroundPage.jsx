import { Bell, CircleUser, Play, Save } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"

import { getSandboxVersions, restoreSandboxVersion, runSandboxSimulation, saveSandboxVersion } from "../api/sandboxApi"
import EmptyState from "../components/ui/EmptyState"
import { useStrategyStore } from "../store/useStrategyStore"

const seedStrategy = {
  name: "RSI Mean Reversion v2.1",
  ticker: "SPY",
  timeframe: "1d",
  asset_class: "equity",
  entry_rules: [
    {
      indicator: "rsi",
      condition: "less_than",
      value: 30,
      params: { period: 14 },
    },
  ],
  exit_rules: [
    {
      indicator: "rsi",
      condition: "greater_than",
      value: 70,
      params: { period: 14 },
    },
  ],
  position_size: 1.0,
  stop_loss_pct: 4,
  take_profit_pct: 8,
  max_hold_days: 20,
  short_allowed: false,
}

const fmtPct = (v, digits = 1) => (v == null ? "-" : `${Number(v).toFixed(digits)}%`)
const fmtNum = (v, digits = 2) => (v == null ? "-" : Number(v).toFixed(digits))
const fmtUsd = (v) => (v == null ? "-" : `$${Number(v).toFixed(2)}`)

const pathFromValues = (values = [], width = 100, height = 26) => {
  if (!values.length) return ""
  const min = Math.min(...values)
  const max = Math.max(...values)
  return values
    .map((v, i) => {
      const x = (i * width) / Math.max(values.length - 1, 1)
      const y = height - ((v - min) / Math.max(max - min, 1)) * (height - 2) - 1
      return `${i === 0 ? "M" : "L"}${x} ${y}`
    })
    .join(" ")
}

export default function SandboxPlaygroundPage() {
  const navigate = useNavigate()
  const {
    currentStrategy,
    updateCurrentStrategy,
    addToast,
  } = useStrategyStore()

  const [rsiPeriod, setRsiPeriod] = useState(14)
  const [oversold, setOversold] = useState(30)
  const [overbought, setOverbought] = useState(70)
  const [positionSize, setPositionSize] = useState(100)
  const [sandboxResult, setSandboxResult] = useState(null)
  const [workflowSteps, setWorkflowSteps] = useState([])
  const [runningSimulation, setRunningSimulation] = useState(false)
  const [savingVersion, setSavingVersion] = useState(false)
  const [versions, setVersions] = useState([])
  const [selectedVersionId, setSelectedVersionId] = useState("")

  const loadVersions = async () => {
    try {
      const response = await getSandboxVersions(20)
      const items = response?.versions || []
      setVersions(items)
      if (!selectedVersionId && items[0]?.id) {
        setSelectedVersionId(items[0].id)
      }
    } catch (err) {
      addToast("error", `Could not load sandbox versions: ${err.message}`)
    }
  }

  useEffect(() => {
    if (!currentStrategy?.ticker) {
      updateCurrentStrategy(seedStrategy)
      return
    }

    const period = currentStrategy.entry_rules?.[0]?.params?.period
    const entryVal = currentStrategy.entry_rules?.[0]?.value
    const exitVal = currentStrategy.exit_rules?.[0]?.value
    if (period != null) setRsiPeriod(Number(period))
    if (entryVal != null) setOversold(Number(entryVal))
    if (exitVal != null) setOverbought(Number(exitVal))
    if (currentStrategy.position_size != null) setPositionSize(Math.round(Number(currentStrategy.position_size) * 100))
  }, [currentStrategy?.ticker])

  useEffect(() => {
    loadVersions()
  }, [])

  useEffect(() => {
    if (!currentStrategy?.ticker) return
    updateCurrentStrategy({
      entry_rules: [
        {
          indicator: "rsi",
          condition: "less_than",
          value: Number(oversold),
          params: { period: Number(rsiPeriod) },
        },
      ],
      exit_rules: [
        {
          indicator: "rsi",
          condition: "greater_than",
          value: Number(overbought),
          params: { period: Number(rsiPeriod) },
        },
      ],
      position_size: Number(positionSize) / 100,
    })
  }, [rsiPeriod, oversold, overbought, positionSize])

  const onSaveVersion = async () => {
    if (!strategy) return
    setSavingVersion(true)
    try {
      const stamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      const response = await saveSandboxVersion({
        strategy,
        resultId: sandboxResult?.id || null,
        label: `${strategy.ticker || "Strategy"} ${stamp}`,
      })
      const saved = response?.version
      if (saved?.id) {
        setSelectedVersionId(saved.id)
        addToast("success", "Sandbox version saved")
        await loadVersions()
      } else {
        addToast("error", "Sandbox version save failed")
      }
    } catch (err) {
      addToast("error", `Sandbox version save failed: ${err.message}`)
    } finally {
      setSavingVersion(false)
    }
  }

  const onRunSimulation = async () => {
    if (!strategy) return
    setRunningSimulation(true)
    try {
      const response = await runSandboxSimulation(strategy, strategy.name || "")
      setSandboxResult(response?.result || null)
      setWorkflowSteps(response?.workflow || [])
      addToast("success", "Simulation complete")
    } catch (err) {
      addToast("error", `Simulation failed: ${err.message}`)
    } finally {
      setRunningSimulation(false)
    }
  }

  const onRestoreVersion = async () => {
    if (!selectedVersionId) {
      addToast("warning", "Select a version to restore")
      return
    }
    try {
      const response = await restoreSandboxVersion(selectedVersionId)
      const restoredStrategy = response?.version?.strategy
      const restoredResultId = response?.version?.result_id
      if (restoredStrategy) {
        updateCurrentStrategy(restoredStrategy)
        if (restoredResultId) {
          setSandboxResult((prev) => ({ ...(prev || {}), id: restoredResultId }))
        }
        addToast("success", "Sandbox version restored")
      }
    } catch (err) {
      addToast("error", `Restore failed: ${err.message}`)
    }
  }

  const strategy = currentStrategy || seedStrategy
  const metrics = sandboxResult?.metrics || {}
  const trades = sandboxResult?.trades || []
  const chartValues = (sandboxResult?.equity_curve || []).slice(-60).map((p) => Number(p.value || 0))
  const linePath = pathFromValues(chartValues, 100, 26)

  const codePreview = useMemo(() => {
    const name = strategy?.name || "RSI Mean Reversion Strategy"
    const sym = String(strategy?.ticker || "SPY").toLowerCase()
    return `# ${name}\ndef initialize(context):\n    context.symbol = '${sym}'\n    context.rsi_period = ${rsiPeriod}\n    context.oversold = ${oversold}\n    context.overbought = ${overbought}\n\ndef handle_data(context, data):\n    rsi = calculate_rsi(data, context.rsi_period)\n\n    if rsi < context.oversold:\n        order_target_percent(context.symbol, ${fmtNum(positionSize / 100, 2)})\n    elif rsi > context.overbought:\n        order_target_percent(context.symbol, 0.0)\n\ndef calculate_rsi(data, period):\n    prices = data.history(period + 1, '1d', 'close')\n    deltas = prices.diff()\n    gain = deltas.where(deltas > 0, 0).rolling(period).mean()\n    loss = -deltas.where(deltas < 0, 0).rolling(period).mean()\n    rs = gain / loss\n    return 100 - (100 / (1 + rs))`
  }, [strategy?.name, strategy?.ticker, rsiPeriod, oversold, overbought, positionSize])

  const winCount = trades.filter((t) => Number(t.return_pct || 0) > 0).length
  const lossCount = trades.filter((t) => Number(t.return_pct || 0) < 0).length
  const simTrades = trades.slice(0, 7)

  if (!strategy) {
    return (
      <div className="sbx-page">
        <EmptyState title="No strategy loaded" action={{ label: "Go to Strategy Lab", onClick: () => navigate("/app/strategy-lab") }} />
      </div>
    )
  }

  return (
    <div className="sbx-page">
      <header className="sbx-topbar">
        <div className="sbx-brand">AI Trading Platform</div>
        <h1>Sandbox Strategy Playground</h1>
        <div className="sbx-tools">
          <button>{strategy.name || "RSI Mean Reversion v2.1"}</button>
          <button>{(strategy.timeframe || "1d").toUpperCase()}</button>
          <button onClick={onSaveVersion} disabled={savingVersion}><Save className="h-3.5 w-3.5" /> {savingVersion ? "Saving..." : "Save Version"}</button>
          <button className="run" onClick={onRunSimulation} disabled={runningSimulation}><Play className="h-3.5 w-3.5" /> {runningSimulation ? "Running..." : "Run Simulation"}</button>
          <Bell className="h-3.5 w-3.5" />
          <CircleUser className="h-3.5 w-3.5" />
        </div>
      </header>

      <main className="sbx-grid">
        <section className="sbx-code-panel">
          <div className="sbx-panel-head">
            <nav>
              <span className="active">Strategy Code</span>
              <span>Parameters</span>
              <span>Filters</span>
            </nav>
            <p>Python · 24/7 lines</p>
          </div>
          <div className="sbx-editor">
            <div className="lines">{Array.from({ length: 22 }).map((_, i) => <span key={i}>{i + 1}</span>)}</div>
            <pre>{codePreview}</pre>
          </div>
        </section>

        <aside className="sbx-right">
          <section className="sbx-kpi-row">
            <article><p>Simulated Return</p><strong className="up">{fmtPct(metrics.total_return_pct, 1)}</strong><span>vs +15.8% baseline</span></article>
            <article><p>Win Rate</p><strong className="up">{fmtPct(metrics.win_rate_pct, 1)}</strong><span>{winCount}/{Math.max(trades.length, 1)} trades</span></article>
            <article><p>Max Drawdown</p><strong className="down">-{fmtPct(metrics.max_drawdown_pct, 1)}</strong><span>Aug 2023</span></article>
            <article><p>Sharpe Ratio</p><strong className="up">{fmtNum(metrics.sharpe_ratio)}</strong><span>+0.15 vs baseline</span></article>
          </section>

          <section className="sbx-panel">
            <div className="sbx-panel-head"><p>Simulation Preview</p><span>6M simulation</span></div>
            <svg viewBox="0 0 100 28" preserveAspectRatio="none" className="sbx-preview-chart">
              <path d={linePath} fill="none" stroke="#00ff9d" strokeWidth="0.7" />
            </svg>
          </section>

          <section className="sbx-panel">
            <div className="sbx-panel-head"><p>AI Agent Workflow</p></div>
            <div className="sbx-version-row">
              {(workflowSteps.length ? workflowSteps : [{ agent: "WorkflowAgent", status: "warning", detail: "Run a simulation to view agent workflow." }]).map((step, idx) => (
                <span key={`${step.agent}-${idx}`} className={step.status === "error" ? "down" : "up"}>
                  {step.agent}: {step.detail}
                </span>
              ))}
            </div>
          </section>

          <section className="sbx-panel">
            <div className="sbx-panel-head"><p>Recent Simulated Trades</p></div>
            <div className="sbx-table-wrap">
              <table className="sbx-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Symbol</th>
                    <th>Direction</th>
                    <th>Entry</th>
                    <th>Exit</th>
                    <th>P/L</th>
                    <th>Return</th>
                  </tr>
                </thead>
                <tbody>
                  {(simTrades.length ? simTrades : [{ id: 0, date_in: "2024-06-15", side: "long", entry_price: 524.3, exit_price: 537.8, pnl_usd: 1350, return_pct: 2.58 }]).map((t) => (
                    <tr key={t.id}>
                      <td>{String(t.date_in || "").slice(0, 10)}</td>
                      <td>{t.symbol || strategy.ticker}</td>
                      <td><span className={`pill ${String(t.side || "long").toLowerCase() === "short" ? "short" : "long"}`}>{String(t.side || "long").toUpperCase()}</span></td>
                      <td>{fmtUsd(t.entry_price)}</td>
                      <td>{fmtUsd(t.exit_price)}</td>
                      <td className={Number(t.pnl_usd || 0) >= 0 ? "up" : "down"}>{fmtUsd(t.pnl_usd)}</td>
                      <td className={Number(t.return_pct || 0) >= 0 ? "up" : "down"}>{fmtPct(t.return_pct, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </aside>

        <section className="sbx-adjustments">
          <div className="sbx-panel-head"><p>Quick Adjustments</p></div>
          <div className="sbx-sliders">
            <div>
              <label>RSI Period</label>
              <strong>{rsiPeriod}</strong>
              <input type="range" min="5" max="30" value={rsiPeriod} onChange={(e) => setRsiPeriod(Number(e.target.value))} />
            </div>
            <div>
              <label>Oversold</label>
              <strong>{oversold}</strong>
              <input type="range" min="20" max="40" value={oversold} onChange={(e) => setOversold(Number(e.target.value))} />
            </div>
            <div>
              <label>Overbought</label>
              <strong>{overbought}</strong>
              <input type="range" min="60" max="85" value={overbought} onChange={(e) => setOverbought(Number(e.target.value))} />
            </div>
            <div>
              <label>Position Size</label>
              <strong>{positionSize}%</strong>
              <input type="range" min="25" max="100" value={positionSize} onChange={(e) => setPositionSize(Number(e.target.value))} />
            </div>
          </div>
        </section>
      </main>

      <footer className="sbx-footer">
        <div className="sbx-version-row">
          <span>Version History</span>
          {(versions.length ? versions : []).slice(0, 4).map((v) => (
            <button
              key={v.id}
              type="button"
              className={selectedVersionId === v.id ? "up" : ""}
              onClick={() => {
                setSelectedVersionId(v.id)
                if (v.result_id) {
                  setSandboxResult((prev) => ({ ...(prev || {}), id: v.result_id, metrics: v.metrics || {} }))
                }
              }}
            >
              {v.label}
            </button>
          ))}
          {versions[0]?.created_at ? <span className="up">Latest · {versions[0].created_at.slice(11, 16)} UTC</span> : null}
        </div>
        <div className="sbx-footer-actions">
          <button onClick={() => navigate("/app/compare")}>Compare Versions</button>
          <button onClick={onRestoreVersion}>Restore Version</button>
          <button onClick={() => {
            const latestResultId = sandboxResult?.id || versions.find((v) => v.result_id)?.result_id
            if (latestResultId) {
              navigate(`/app/results/${latestResultId}`)
              return
            }
            addToast("warning", "Run a simulation first to open analytics")
          }}>
            Open Analytics
          </button>
        </div>
      </footer>
    </div>
  )
}

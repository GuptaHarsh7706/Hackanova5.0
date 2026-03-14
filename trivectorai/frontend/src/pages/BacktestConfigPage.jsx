import { Bell, CheckCircle2, CircleUser, Cog } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { Link, useNavigate } from "react-router-dom"

import {
  addBacktestAsset,
  estimateDataRangeMeta,
  getSavedBacktestConfig,
  getBacktestAssets,
  getDataSources,
  getStrategySummary,
  listSavedBacktestConfigs,
  resolveBacktestConfigApiUrl,
  runFromBacktestConfig,
  saveBacktestConfig,
  scoreBacktestConfig,
  validateBacktestConfig,
} from "../api/backtestConfigApi"
import { getBacktestJobResult } from "../api/strategyBuilderApi"
import { useStrategyStore } from "../store/useStrategyStore"

const universe = ["AAPL", "MSFT", "GOOGL", "TSLA", "AMZN", "NVDA"]

export default function BacktestConfigPage() {
  const navigate = useNavigate()
  const currentStrategy = useStrategyStore((s) => s.currentStrategy)
  const parseCanRun = useStrategyStore((s) => s.parseCanRun)
  const runBacktest = useStrategyStore((s) => s.runBacktest)
  const backtestLoading = useStrategyStore((s) => s.backtestLoading)
  const updateCurrentStrategy = useStrategyStore((s) => s.updateCurrentStrategy)

  const [selectedAssets, setSelectedAssets] = useState(() => [currentStrategy?.ticker || "AAPL", "MSFT", "GOOGL", "TSLA"])
  const [assetUniverse, setAssetUniverse] = useState(universe)
  const [timeframe, setTimeframe] = useState(currentStrategy?.timeframe || "1h")
  const [assetClass, setAssetClass] = useState(currentStrategy?.asset_class || "equity")
  const [dataSource, setDataSource] = useState("yahoo_finance")
  const [dataSources, setDataSources] = useState([])
  const [startDate, setStartDate] = useState("2020-01-01")
  const [endDate, setEndDate] = useState("2024-01-15")
  const [initialCapital, setInitialCapital] = useState(100000)
  const [positionSizing, setPositionSizing] = useState("% of Capital")
  const [positionPct, setPositionPct] = useState(5)
  const [stopLoss, setStopLoss] = useState(Number(currentStrategy?.stop_loss_pct ?? 2))
  const [takeProfit, setTakeProfit] = useState(Number(currentStrategy?.take_profit_pct ?? 5))
  const [maxPositionUsd, setMaxPositionUsd] = useState(5000)
  const [maxDrawdown, setMaxDrawdown] = useState(15)
  const [maxConcurrentTrades, setMaxConcurrentTrades] = useState(3)
  const [commission, setCommission] = useState(0.5)
  const [slippage, setSlippage] = useState(0.05)
  const [newAssetSymbol, setNewAssetSymbol] = useState("")
  const [addingAsset, setAddingAsset] = useState(false)
  const [strategySummary, setStrategySummary] = useState(null)
  const [scoreData, setScoreData] = useState(null)
  const [validationData, setValidationData] = useState(null)
  const [rangeMeta, setRangeMeta] = useState(null)
  const [savedConfigId, setSavedConfigId] = useState("")
  const [savedConfigs, setSavedConfigs] = useState([])
  const [saveStatus, setSaveStatus] = useState("")
  const [saving, setSaving] = useState(false)
  const [runStatus, setRunStatus] = useState("")
  const [runProgress, setRunProgress] = useState(0)
  const streamRef = useRef(null)

  const fallbackReadyScore = useMemo(() => {
    let score = 70
    if (parseCanRun) score += 20
    if (stopLoss > 0 && takeProfit > stopLoss) score += 6
    if (selectedAssets.length >= 3) score += 4
    return Math.min(100, score)
  }, [parseCanRun, stopLoss, takeProfit, selectedAssets])

  const buildConfigPayload = () => ({
    strategy_id: currentStrategy?.id || null,
    name: (strategySummary?.strategy_name || "Backtest Config") + " Configuration",
    data_source: dataSource,
    asset_class: assetClass,
    selected_assets: selectedAssets,
    start_date: startDate,
    end_date: endDate,
    timeframe,
    initial_capital: initialCapital,
    position_sizing_method: positionSizing,
    position_pct: positionPct,
    risk_parameters: {
      stop_loss_pct: stopLoss,
      take_profit_pct: takeProfit,
      max_position_usd: maxPositionUsd,
      max_drawdown_pct: maxDrawdown,
        max_concurrent_trades: maxConcurrentTrades,
    },
    transaction_costs: {
      commission_per_trade: commission,
      slippage_pct: slippage,
    },
  })

  useEffect(() => {
    let mounted = true
    const hydrate = async () => {
      try {
        const [summary, assets, sources, saved] = await Promise.all([
          getStrategySummary(currentStrategy?.id),
          getBacktestAssets(assetClass),
          getDataSources(),
          listSavedBacktestConfigs({ strategy_id: currentStrategy?.id, limit: 25 }),
        ])
        if (!mounted) return
        setStrategySummary(summary)
        setDataSources(sources)
        setSavedConfigs(saved)
        if (saved?.length > 0) {
          setSavedConfigId(saved[0].id)
        }
        if (sources?.length > 0) setDataSource(sources[0].id)

        const symbols = (assets?.items || []).map((item) => item.symbol)
        if (symbols.length > 0) setAssetUniverse(symbols)
        if (Array.isArray(assets?.defaults) && assets.defaults.length > 0) {
          setSelectedAssets(assets.defaults)
        }
      } catch {
        if (!mounted) return
        setStrategySummary(null)
      }
    }

    hydrate()
    return () => {
      mounted = false
    }
  }, [assetClass, currentStrategy?.id])

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const config = buildConfigPayload()
        const [score, dataRange, validation] = await Promise.all([
          scoreBacktestConfig(config),
          estimateDataRangeMeta({
            start_date: startDate,
            end_date: endDate,
            timeframe,
            selected_assets: selectedAssets,
          }),
          validateBacktestConfig(config),
        ])
        setScoreData(score)
        setRangeMeta(dataRange)
        setValidationData(validation)
      } catch {
        setScoreData(null)
        setRangeMeta(null)
        setValidationData(null)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [timeframe, startDate, endDate, selectedAssets, initialCapital, positionSizing, positionPct, stopLoss, takeProfit, maxPositionUsd, maxDrawdown, maxConcurrentTrades, commission, slippage, dataSource, assetClass])

  const toggleAsset = (ticker) => {
    setSelectedAssets((prev) =>
      prev.includes(ticker) ? prev.filter((x) => x !== ticker) : [...prev, ticker]
    )
  }

  const onAddAsset = async () => {
    const symbol = newAssetSymbol.trim().toUpperCase()
    if (!symbol) return
    setAddingAsset(true)
    setSaveStatus("")
    try {
      await addBacktestAsset({ symbol, asset_class: assetClass })
      const assets = await getBacktestAssets(assetClass)
      const symbols = (assets?.items || []).map((item) => item.symbol)
      if (symbols.length > 0) setAssetUniverse(symbols)
      setSelectedAssets((prev) => (prev.includes(symbol) ? prev : [...prev, symbol]))
      setNewAssetSymbol("")
      setSaveStatus(`Added asset ${symbol}`)
    } catch (error) {
      setSaveStatus(error.message || "Failed to add asset")
    } finally {
      setAddingAsset(false)
    }
  }

  const onSave = async () => {
    setSaving(true)
    setSaveStatus("")
    try {
      const payload = buildConfigPayload()
      const saved = await saveBacktestConfig(payload)
      setSaveStatus(`Saved as ${saved.configuration_id}`)
      setSavedConfigId(saved.configuration_id)
      const refreshed = await listSavedBacktestConfigs({ strategy_id: currentStrategy?.id, limit: 25 })
      setSavedConfigs(refreshed)
    } catch (error) {
      setSaveStatus(error.message || "Save failed")
    } finally {
      setSaving(false)
    }
  }

  const onLoadSavedConfig = async (configId) => {
    if (!configId) return
    try {
      const config = await getSavedBacktestConfig(configId)
      setSavedConfigId(config.id || configId)
      setSelectedAssets(config.selected_assets || selectedAssets)
      setTimeframe(config.timeframe || timeframe)
      setAssetClass(config.asset_class || assetClass)
      setDataSource(config.data_source || dataSource)
      setStartDate(config.start_date || startDate)
      setEndDate(config.end_date || endDate)
      setInitialCapital(Number(config.initial_capital ?? initialCapital))
      setPositionSizing(config.position_sizing_method || positionSizing)
      setPositionPct(Number(config.position_pct ?? positionPct))
      setStopLoss(Number(config.risk_parameters?.stop_loss_pct ?? stopLoss))
      setTakeProfit(Number(config.risk_parameters?.take_profit_pct ?? takeProfit))
      setMaxPositionUsd(Number(config.risk_parameters?.max_position_usd ?? maxPositionUsd))
      setMaxDrawdown(Number(config.risk_parameters?.max_drawdown_pct ?? maxDrawdown))
      setMaxConcurrentTrades(Number(config.risk_parameters?.max_concurrent_trades ?? maxConcurrentTrades))
      setCommission(Number(config.transaction_costs?.commission_per_trade ?? commission))
      setSlippage(Number(config.transaction_costs?.slippage_pct ?? slippage))
      setSaveStatus(`Loaded ${config.id || configId}`)
    } catch (error) {
      setSaveStatus(error.message || "Load failed")
    }
  }

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.close()
        streamRef.current = null
      }
    }
  }, [])

  const onRun = async () => {
    const primaryTicker = selectedAssets[0] || currentStrategy?.ticker || "AAPL"
    if (!primaryTicker) return

    setRunStatus("Submitting backtest run...")
    setRunProgress(0)

    let configId = savedConfigId
    if (!configId) {
      const saved = await saveBacktestConfig(buildConfigPayload())
      configId = saved.configuration_id
      setSavedConfigId(configId)
      const refreshed = await listSavedBacktestConfigs({ strategy_id: currentStrategy?.id, limit: 25 })
      setSavedConfigs(refreshed)
    }

    const strategyPayload = {
      ...(currentStrategy || {}),
      ticker: primaryTicker,
      timeframe,
      asset_class: assetClass,
      stop_loss_pct: stopLoss,
      take_profit_pct: takeProfit,
      position_size: Math.max(0.01, Math.min(1, positionPct / 100)),
    }

    updateCurrentStrategy({
      ticker: primaryTicker,
      timeframe,
      asset_class: assetClass,
      stop_loss_pct: stopLoss,
      take_profit_pct: takeProfit,
      position_size: Math.max(0.01, Math.min(1, positionPct / 100)),
    })

    try {
      const run = await runFromBacktestConfig({
        configuration_id: configId,
        strategy: strategyPayload,
        session_id: useStrategyStore.getState().sessionId || undefined,
        natural_language: "Run backtest from Backtest Configuration",
      })

      const streamUrl = resolveBacktestConfigApiUrl(run.stream_url)
      await new Promise((resolve, reject) => {
        const source = new EventSource(streamUrl)
        streamRef.current = source

        source.addEventListener("queued", (evt) => {
          try {
            const payload = JSON.parse(evt.data)
            setRunStatus(payload.message || "Queued")
            setRunProgress(Number(payload.progress || 0))
          } catch {
            // ignore malformed payload
          }
        })

        source.addEventListener("progress", (evt) => {
          try {
            const payload = JSON.parse(evt.data)
            setRunStatus(payload.message || payload.current_step || "Running backtest")
            setRunProgress(Number(payload.progress || 0))
          } catch {
            // ignore malformed payload
          }
        })

        source.addEventListener("result_ready", async (evt) => {
          try {
            source.close()
            streamRef.current = null
            const payload = JSON.parse(evt.data)
            const finalRes = await getBacktestJobResult(payload.job_id || run.job_id)
            const result = finalRes?.result
            const resultId = result?.id
            if (!result || !resultId) throw new Error("Result missing from completed job")

            useStrategyStore.setState({
              backtestResult: result,
              currentResultId: resultId,
            })

            setRunStatus("Backtest completed")
            setRunProgress(100)
            navigate(`/app/results/${resultId}`)
            resolve()
          } catch (error) {
            reject(error)
          }
        })

        source.addEventListener("error", () => {
          source.close()
          streamRef.current = null
          reject(new Error("Backtest stream disconnected"))
        })
      })
    } catch (error) {
      setRunStatus(error.message || "Run failed; trying fallback")
      await runBacktest(navigate)
    }
  }

  return (
    <div className="bt-page">
      <header className="lab-topbar">
        <div className="lab-brand">FINTECH</div>
        <nav className="lab-nav">
          <Link to="/app/dashboard">Dashboard</Link>
          <Link to="/app/strategy-lab">Strategy Lab</Link>
          <Link className="active" to="/app/backtests">Backtests</Link>
          <Link to="/app/live-signals">Live Signals</Link>
          <Link to="/app/market-data">Market Data</Link>
          <a href="#">Analytics</a>
        </nav>
        <div className="lab-tools">
          <Bell className="h-3.5 w-3.5" />
          <Cog className="h-3.5 w-3.5" />
          <CircleUser className="h-3.5 w-3.5" />
        </div>
      </header>

      <div className="bt-grid">
        <aside className="bt-left">
          <section className="lab-panel">
            <h2 className="bt-name">{strategySummary?.strategy_name || "Backtest Strategy"}</h2>
            <div className="bt-meta">
              <div><span>Strategy Type</span><b>{strategySummary?.strategy_type || "Momentum Crossover"}</b></div>
              <div><span>Timeframe</span><b>{timeframe}</b></div>
              <div><span>Indicators</span><b>{strategySummary?.indicators_active || 6} Active</b></div>
            </div>
          </section>

          <section className="lab-panel">
            <p className="lab-title">Asset Selection</p>
            <div className="bt-assets">
              {assetUniverse.map((ticker) => (
                <button
                  key={ticker}
                  className={selectedAssets.includes(ticker) ? "on" : "off"}
                  onClick={() => toggleAsset(ticker)}
                >
                  {ticker}
                </button>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                className="flex-1 rounded-sm border border-[var(--border-default)] bg-[rgba(0,0,0,.35)] px-2 py-1 text-[11px]"
                placeholder="Add symbol (e.g. NFLX)"
                value={newAssetSymbol}
                onChange={(e) => setNewAssetSymbol(e.target.value)}
              />
              <button className="bt-add-asset" disabled={addingAsset || !newAssetSymbol.trim()} onClick={onAddAsset}>
                {addingAsset ? "Adding..." : "+ Add"}
              </button>
            </div>
          </section>

          <section className="lab-panel">
            <p className="lab-title">Data Source</p>
            <div className="bt-radio-list">
              {(dataSources.length > 0 ? dataSources : [
                { id: "bloomberg", label: "Bloomberg" },
                { id: "yahoo_finance", label: "Yahoo Finance" },
                { id: "alpha_vantage", label: "Alpha Vantage" },
                { id: "custom_csv", label: "Custom CSV Upload" },
              ]).map((source) => (
                <label key={source.id}>
                  <input type="radio" checked={dataSource === source.id} onChange={() => setDataSource(source.id)} /> {source.label}
                </label>
              ))}
            </div>
            <div className="bt-badge">Institutional Grade</div>
          </section>
        </aside>

        <main className="bt-center">
          <section className="lab-panel">
            <p className="lab-title">Historical Data Range</p>
            <div className="bt-range-head">
              <strong>{rangeMeta ? `${Math.floor(rangeMeta.duration_days / 365)} Years, ${rangeMeta.duration_days % 365} Days` : "4 Years, 15 Days"}</strong>
            </div>
            <div className="bt-range-line">
              <span className="left" />
              <span className="right" />
            </div>
            <div className="bt-range-dates"><span>{startDate}</span><span>{endDate}</span></div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
              <label className="flex flex-col gap-1">
                Start Date
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </label>
              <label className="flex flex-col gap-1">
                End Date
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </label>
            </div>
            <div className="bt-range-presets">
              {['1Y', '2Y', '5Y', '10Y', 'MAX'].map((x) => (
                <button
                  key={x}
                  onClick={() => {
                    const end = new Date()
                    const start = new Date()
                    if (x === '1Y') start.setFullYear(end.getFullYear() - 1)
                    if (x === '2Y') start.setFullYear(end.getFullYear() - 2)
                    if (x === '5Y') start.setFullYear(end.getFullYear() - 5)
                    if (x === '10Y') start.setFullYear(end.getFullYear() - 10)
                    if (x === 'MAX') start.setFullYear(end.getFullYear() - 15)
                    setStartDate(start.toISOString().slice(0, 10))
                    setEndDate(end.toISOString().slice(0, 10))
                  }}
                >
                  {x}
                </button>
              ))}
            </div>
          </section>

          <section className="bt-row2">
            <div className="lab-panel">
              <p className="lab-title">Initial Capital</p>
              <div className="bt-capital">
                <strong>${initialCapital.toLocaleString()}</strong>
                <span>USD</span>
              </div>
              <input type="range" min={10000} max={1000000} step={5000} value={initialCapital} onChange={(e) => setInitialCapital(Number(e.target.value))} />
            </div>

            <div className="lab-panel">
              <p className="lab-title">Position Sizing Method</p>
              <div className="bt-radio-list compact">
                {['Fixed Amount', '% of Capital', 'Kelly Criterion', 'Risk Parity'].map((m) => (
                  <label key={m}><input type="radio" checked={positionSizing === m} onChange={() => setPositionSizing(m)} /> {m}</label>
                ))}
              </div>
              <p className="bt-highlight">{positionPct}%</p>
              <input type="range" min={1} max={25} value={positionPct} onChange={(e) => setPositionPct(Number(e.target.value))} />
            </div>
          </section>

          <section className="lab-panel">
            <p className="lab-title">Risk Parameters</p>
            <div className="bt-risk-grid">
              <div><span>Stop Loss</span><strong>{stopLoss.toFixed(1)}%</strong><input type="range" min={0.5} max={10} step={0.1} value={stopLoss} onChange={(e) => setStopLoss(Number(e.target.value))} /></div>
              <div><span>Take Profit</span><strong>{takeProfit.toFixed(1)}%</strong><input type="range" min={1} max={20} step={0.1} value={takeProfit} onChange={(e) => setTakeProfit(Number(e.target.value))} /></div>
              <div><span>Max Position Size</span><strong>${maxPositionUsd.toLocaleString()}</strong><input type="range" min={1000} max={20000} step={500} value={maxPositionUsd} onChange={(e) => setMaxPositionUsd(Number(e.target.value))} /></div>
              <div><span>Leverage</span><strong>1x</strong></div>
              <div><span>Max Drawdown</span><strong className="down">{maxDrawdown}%</strong><input type="range" min={5} max={35} value={maxDrawdown} onChange={(e) => setMaxDrawdown(Number(e.target.value))} /></div>
              <div><span>Max Concurrent Trades</span><strong>{maxConcurrentTrades}</strong><input type="range" min={1} max={15} value={maxConcurrentTrades} onChange={(e) => setMaxConcurrentTrades(Number(e.target.value))} /></div>
            </div>
          </section>

          {validationData?.issues?.length ? (
            <section className="lab-panel">
              <p className="lab-title">Validation & Risk Notes</p>
              <ul className="space-y-1 text-[11px]">
                {validationData.issues.map((issue, idx) => (
                  <li key={`${issue.field}-${idx}`} className={issue.severity === "error" ? "down" : "text-[var(--text-secondary)]"}>
                    {issue.severity.toUpperCase()}: {issue.message}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="lab-panel">
            <p className="lab-title">Transaction Costs & Slippage</p>
            <div className="bt-cost-grid">
              <div>
                <span>Commission</span>
                <input type="number" value={commission} onChange={(e) => setCommission(Number(e.target.value))} />
                <small>${commission.toFixed(2)} per trade</small>
              </div>
              <div>
                <span>Average Slippage</span>
                <input type="number" value={slippage} onChange={(e) => setSlippage(Number(e.target.value))} />
                <small>{slippage.toFixed(2)}% avg</small>
              </div>
            </div>
          </section>
        </main>

        <aside className="bt-right">
          <section className="lab-panel bt-score">
            <CheckCircle2 className="h-8 w-8 text-[#00ff66]" />
            <p>Ready to Run</p>
            <span>Configuration Score</span>
            <strong>{scoreData?.score ?? validationData?.readiness_score ?? fallbackReadyScore}/100</strong>
          </section>

          <section className="lab-panel">
            <p className="lab-title">Key Parameters</p>
            <div className="bt-summary-list">
              <div><span>Assets</span><b>{selectedAssets.length} selected</b></div>
              <div><span>Data Points</span><b>~{(scoreData?.estimated_data_points || rangeMeta?.estimated_data_points || 35840).toLocaleString()}</b></div>
              <div><span>Initial Capital</span><b>${initialCapital.toLocaleString()}</b></div>
              <div><span>Risk per Trade</span><b>{positionPct}%</b></div>
              <div><span>Stop Loss</span><b>{stopLoss}%</b></div>
              <div><span>Take Profit</span><b>{takeProfit}%</b></div>
              <div><span>Commission</span><b>${commission.toFixed(2)}/trade</b></div>
            </div>
          </section>

          <section className="lab-panel">
            <p className="lab-title">Estimated Runtime</p>
            <p className="bt-runtime">~{scoreData?.estimated_runtime_seconds || rangeMeta?.estimated_runtime_seconds || 45} seconds</p>
            <div className="bt-runtime-bars">
              <span style={{ width: `${Math.max(15, Math.min(80, (scoreData?.estimated_runtime_seconds || rangeMeta?.estimated_runtime_seconds || 45) * 0.9))}%` }} />
              <span style={{ width: `${Math.max(10, Math.min(60, (scoreData?.estimated_runtime_seconds || rangeMeta?.estimated_runtime_seconds || 45) * 0.55))}%` }} />
              <span style={{ width: `${Math.max(8, Math.min(40, (scoreData?.estimated_runtime_seconds || rangeMeta?.estimated_runtime_seconds || 45) * 0.35))}%` }} />
            </div>
          </section>

          <section className="lab-panel bt-actions">
            <button className="btn-green" disabled={(!parseCanRun && !validationData?.can_run) || backtestLoading} onClick={onRun}>
              {backtestLoading ? 'Running Backtest...' : 'Run Backtest'}
            </button>
            <button className="btn-yellow" disabled={saving} onClick={onSave}>{saving ? 'Saving...' : 'Save Configuration'}</button>
            <select value={savedConfigId} onChange={(e) => onLoadSavedConfig(e.target.value)}>
              <option value="">Load Saved Configuration</option>
              {savedConfigs.map((item) => (
                <option key={item.id} value={item.id}>{item.name || item.id}</option>
              ))}
            </select>
            {runStatus ? <small>{runStatus} {runProgress > 0 ? `(${runProgress}%)` : ""}</small> : null}
            {saveStatus ? <small>{saveStatus}</small> : null}
          </section>
        </aside>
      </div>

      <footer className="lab-footer">
        <span>{savedConfigId ? `Last configuration: ${savedConfigId}` : "No configuration saved yet"}</span>
        <span><b className="up">●</b> {(dataSources.find((s) => s.id === dataSource)?.label || dataSource || "Data Source")}: {(dataSources.find((s) => s.id === dataSource)?.connected ?? true) ? "Connected" : "Unavailable"}</span>
        <span>System Ready</span>
      </footer>
    </div>
  )
}

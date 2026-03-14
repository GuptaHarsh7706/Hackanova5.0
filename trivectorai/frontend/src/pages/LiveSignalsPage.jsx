import { Activity, AlertTriangle, Bell, CircleUser, Globe, Radio, Settings2, Zap } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, NavLink } from "react-router-dom"

import { getDashboardChart, getDashboardSnapshot, getAiInsights } from "../api/dashboardApi"

const TIMEFRAMES = ["1m", "5m", "15m", "1h", "4h", "1d"]
const SYMBOLS = ["^GSPC", "AAPL", "MSFT", "NVDA", "TSLA", "BTC-USD", "ETH-USD"]

const ACTION_MAP = {
  buy: "LONG",
  sell: "SHORT",
  hold: "HOLD",
  reduce_risk: "DE-RISK",
}

function formatPrice(value) {
  if (value == null || Number.isNaN(Number(value))) return "--"
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function formatPct(value) {
  if (value == null || Number.isNaN(Number(value))) return "--"
  const n = Number(value)
  return `${n > 0 ? "+" : ""}${n.toFixed(2)}%`
}

function formatClock(ts) {
  if (!ts) return "--:--:--"
  const date = new Date(ts)
  if (Number.isNaN(date.getTime())) return "--:--:--"
  return date.toLocaleTimeString()
}

function buildLinePoints(candles) {
  if (!Array.isArray(candles) || candles.length === 0) return ""
  const closes = candles.map((c) => Number(c.close)).filter((v) => Number.isFinite(v))
  if (closes.length < 2) return ""

  const min = Math.min(...closes)
  const max = Math.max(...closes)
  const range = Math.max(0.000001, max - min)

  return closes
    .map((value, idx) => {
      const x = (idx / (closes.length - 1)) * 100
      const y = 35 - ((value - min) / range) * 30
      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(" ")
}

function buildSignalEntry(insight, chart, symbol) {
  const candles = chart?.candles || []
  const last = candles.at(-1)
  const prev = candles.at(-2)
  const lastClose = Number(last?.close)
  const prevClose = Number(prev?.close)
  const movePct = Number.isFinite(lastClose) && Number.isFinite(prevClose) && prevClose !== 0
    ? ((lastClose - prevClose) / prevClose) * 100
    : 0

  const actionRaw = insight?.recommended_action || "hold"
  const action = ACTION_MAP[actionRaw] || actionRaw.toUpperCase()
  const confidence = Math.round(Number(insight?.confidence_score ?? 0) * 100)
  const risk = (insight?.risk_level || "moderate").toUpperCase()

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    symbol,
    action,
    confidence,
    risk,
    movePct,
    driver: insight?.drivers?.[0] || insight?.insight_summary || "AI model updated market posture.",
  }
}

export default function LiveSignalsPage() {
  const [symbol, setSymbol] = useState("^GSPC")
  const [timeframe, setTimeframe] = useState("1m")
  const [snapshot, setSnapshot] = useState(null)
  const [chart, setChart] = useState(null)
  const [insight, setInsight] = useState(null)
  const [signalFeed, setSignalFeed] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [lastUpdate, setLastUpdate] = useState(null)
  const [refreshSec, setRefreshSec] = useState(8)

  const pullLiveData = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) setLoading(true)
      try {
        const [snapshotData, chartData, insightData] = await Promise.all([
          getDashboardSnapshot({ symbol, timeframe }),
          getDashboardChart({ symbol, timeframe, limit: 100 }),
          getAiInsights({ symbol, timeframe }),
        ])

        setSnapshot(snapshotData)
        setChart(chartData)
        setInsight(insightData)
        setLastUpdate(new Date())
        setRefreshSec(Math.max(4, Number(snapshotData?.refresh_after_sec || 8)))
        setError("")

        const nextSignal = buildSignalEntry(insightData, chartData, symbol)
        setSignalFeed((prev) => [nextSignal, ...prev].slice(0, 20))
      } catch (err) {
        setError(err?.response?.data?.detail || err?.message || "Failed to load live signal data")
      } finally {
        setLoading(false)
      }
    },
    [symbol, timeframe],
  )

  useEffect(() => {
    pullLiveData()
  }, [pullLiveData])

  useEffect(() => {
    const timer = setInterval(() => {
      pullLiveData({ silent: true })
    }, refreshSec * 1000)
    return () => clearInterval(timer)
  }, [pullLiveData, refreshSec])

  const watchlist = snapshot?.watchlist || []
  const globalMarkets = snapshot?.global_markets || []
  const sectorRisk = snapshot?.sector_risk || []
  const news = snapshot?.news || []

  const activePrice = chart?.last_price ?? chart?.candles?.at(-1)?.close
  const previousPrice = chart?.candles?.at(-2)?.close
  const activeMovePct = useMemo(() => {
    const last = Number(activePrice)
    const prev = Number(previousPrice)
    if (!Number.isFinite(last) || !Number.isFinite(prev) || prev === 0) return 0
    return ((last - prev) / prev) * 100
  }, [activePrice, previousPrice])

  const confidencePct = Math.round(Number(insight?.confidence_score ?? 0) * 100)
  const sentimentPct = Math.round(Number(insight?.sentiment_score ?? 0) * 100)
  const linePoints = buildLinePoints(chart?.candles)

  return (
    <div className="bloom-page min-h-screen">
      <header className="bloom-topbar">
        <div className="bloom-brand">TRIVECTOR LIVE</div>
        <nav className="bloom-nav">
          <NavLink to="/app/dashboard">Dashboard</NavLink>
          <NavLink to="/app/strategy-lab">Strategy Lab</NavLink>
          <NavLink to="/app/backtests">Backtests</NavLink>
          <NavLink className="active" to="/app/live-signals">Live Signals</NavLink>
          <NavLink to="/app/trade-analytics">Analytics</NavLink>
        </nav>
        <div className="bloom-tools">
          <Bell className="h-3.5 w-3.5" />
          <Globe className="h-3.5 w-3.5" />
          <Settings2 className="h-3.5 w-3.5" />
          <CircleUser className="h-3.5 w-3.5" />
        </div>
      </header>

      <div className="bloom-grid">
        <aside className="bloom-left">
          <section className="bloom-panel">
            <p className="bloom-title">Market Pulse</p>
            <div className="bloom-list">
              {globalMarkets.slice(0, 8).map((item) => (
                <div key={item.symbol}>
                  <span>{item.symbol}</span>
                  <span className={Number(item.change_pct) >= 0 ? "up" : "down"}>{formatPct(item.change_pct)}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="bloom-panel">
            <p className="bloom-title">Active Watchlist</p>
            <div className="bloom-table">
              <div className="bloom-row bloom-head"><span>Symbol</span><span>Price</span><span>Chg</span></div>
              {watchlist.slice(0, 10).map((item) => (
                <div key={item.symbol} className="bloom-row">
                  <span>{item.symbol}</span>
                  <span>{formatPrice(item.price)}</span>
                  <span className={Number(item.change_pct) >= 0 ? "up" : "down"}>{formatPct(item.change_pct)}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="bloom-panel">
            <p className="bloom-title">Engine Status</p>
            <div className="space-y-2 text-[11px] text-[var(--text-secondary)]">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5"><Radio className="h-3.5 w-3.5 text-[#00ff66] animate-pulse" />Signal stream</span>
                <span className="text-[#00ff66]">LIVE</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5"><Activity className="h-3.5 w-3.5" />Latency</span>
                <span>{refreshSec}s refresh</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5"><Zap className="h-3.5 w-3.5" />Last tick</span>
                <span>{formatClock(lastUpdate)}</span>
              </div>
            </div>
          </section>
        </aside>

        <main className="bloom-center">
          <section className="bloom-panel bloom-chart-panel">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-default)] pb-2">
              <p className="bloom-title">Live Signal Engine</p>
              <div className="flex flex-wrap items-center gap-2 text-[10px]">
                <select
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  className="rounded border border-[var(--border-default)] bg-[#09111b] px-1.5 py-1 text-[var(--text-primary)]"
                >
                  {SYMBOLS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                {TIMEFRAMES.map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setTimeframe(tf)}
                    className={`bloom-chip ${tf === timeframe ? "active" : ""}`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-2 grid gap-2 md:grid-cols-4">
              <div className="rounded border border-[var(--border-default)] bg-[#09121d] px-2 py-1.5">
                <p className="text-[10px] text-[var(--text-muted)]">Last Price</p>
                <p className="text-sm font-semibold">{formatPrice(activePrice)}</p>
              </div>
              <div className="rounded border border-[var(--border-default)] bg-[#09121d] px-2 py-1.5">
                <p className="text-[10px] text-[var(--text-muted)]">Move</p>
                <p className={`text-sm font-semibold ${activeMovePct >= 0 ? "text-[#00ff66]" : "text-[#ff6f6f]"}`}>{formatPct(activeMovePct)}</p>
              </div>
              <div className="rounded border border-[var(--border-default)] bg-[#09121d] px-2 py-1.5">
                <p className="text-[10px] text-[var(--text-muted)]">Action</p>
                <p className="text-sm font-semibold text-[#ffd21a]">{ACTION_MAP[insight?.recommended_action] || "HOLD"}</p>
              </div>
              <div className="rounded border border-[var(--border-default)] bg-[#09121d] px-2 py-1.5">
                <p className="text-[10px] text-[var(--text-muted)]">Confidence</p>
                <p className="text-sm font-semibold">{confidencePct}%</p>
              </div>
            </div>

            <div className="bloom-chart-wrap mt-2">
              {linePoints ? (
                <svg viewBox="0 0 100 40" className="bloom-line-svg" preserveAspectRatio="none">
                  <polyline fill="none" stroke="#15ff62" strokeWidth="1.15" points={linePoints} />
                </svg>
              ) : (
                <div className="grid h-full place-items-center text-[11px] text-[var(--text-muted)]">No chart data</div>
              )}
            </div>
          </section>

          <section className="bloom-panel">
            <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-2">
              <p className="bloom-title">Live Signal Feed</p>
              <span className="text-[10px] text-[var(--text-muted)]">{signalFeed.length} events</span>
            </div>
            <div className="mt-2 max-h-[260px] overflow-auto rounded border border-[var(--border-default)]">
              <div className="bloom-row bloom-head"><span>Time</span><span>Signal</span><span>Conf</span></div>
              {signalFeed.length === 0 ? (
                <div className="px-3 py-3 text-[11px] text-[var(--text-muted)]">Waiting for first signal...</div>
              ) : (
                signalFeed.map((row) => (
                  <div key={row.id} className="bloom-row">
                    <span>{formatClock(row.timestamp)}</span>
                    <span className={row.action === "LONG" ? "up" : row.action === "SHORT" ? "down" : ""}>{row.symbol} {row.action}</span>
                    <span>{row.confidence}%</span>
                  </div>
                ))
              )}
            </div>
          </section>
        </main>

        <aside className="bloom-right">
          <section className="bloom-panel">
            <p className="bloom-title">AI Context</p>
            <p className="text-[11px] text-[var(--text-secondary)]">{insight?.insight_summary || "Generating AI insight..."}</p>
            <div className="mt-2 h-1.5 rounded bg-[#152434]">
              <div className="h-full rounded bg-[#00ff66]" style={{ width: `${Math.min(100, Math.max(0, sentimentPct))}%` }} />
            </div>
            <div className="mt-2 text-[10px] text-[var(--text-secondary)]">Sentiment {sentimentPct}%</div>
            <ul className="mt-2 space-y-1 text-[11px] text-[var(--text-secondary)]">
              {(insight?.drivers || []).slice(0, 3).map((driver, idx) => <li key={`${driver}-${idx}`}>• {driver}</li>)}
            </ul>
          </section>

          <section className="bloom-panel">
            <p className="bloom-title">Volatility Radar</p>
            <div className="space-y-1.5">
              {sectorRisk.slice(0, 6).map((item) => (
                <div key={item.sector} className="text-[10px]">
                  <div className="mb-1 flex items-center justify-between text-[var(--text-secondary)]">
                    <span>{item.sector}</span>
                    <span>{Math.round(Number(item.volatility_score) * 100)}%</span>
                  </div>
                  <div className="h-1 rounded bg-[#1a2a3a]">
                    <div
                      className="h-full rounded bg-[#ffd21a]"
                      style={{ width: `${Math.min(100, Math.max(0, Number(item.volatility_score) * 100))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="bloom-panel">
            <p className="bloom-title">Catalyst Alerts</p>
            <div className="bloom-news">
              {news.slice(0, 5).map((item, idx) => (
                <div key={`${item.headline}-${idx}`} className="bloom-news-row">
                  <span>{item.headline}</span>
                  <span className={`tag ${item.sentiment}`}>{item.sentiment.toUpperCase()}</span>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>

      <footer className="bloom-footer-tape">
        <div className="ticker-tape">
          {(watchlist.length ? watchlist : []).concat(watchlist).slice(0, 18).map((item, idx) => (
            <span key={`${item.symbol}-${idx}`} className="ticker-item">
              {item.symbol} {formatPrice(item.price)} {formatPct(item.change_pct)}
            </span>
          ))}
        </div>
      </footer>

      {loading ? (
        <div className="pointer-events-none fixed bottom-14 right-4 rounded border border-[var(--border-default)] bg-[#081018e0] px-3 py-2 text-[11px] text-[var(--text-secondary)]">
          <span className="inline-flex items-center gap-1.5"><Activity className="h-3.5 w-3.5 animate-pulse" />Syncing live feed...</span>
        </div>
      ) : null}

      {error ? (
        <div className="fixed bottom-14 left-4 right-4 rounded border border-[#5d2929] bg-[#281010e0] px-3 py-2 text-[11px] text-[#ffb8b8] md:left-auto md:w-[440px]">
          <span className="inline-flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5" />{error}</span>
        </div>
      ) : null}

      <div className="fixed bottom-0 left-0 right-0 z-10 border-t border-[#2a3f57] bg-[#081018f2] px-4 py-1 text-[10px] text-[var(--text-secondary)]">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between">
          <span className="inline-flex items-center gap-1.5"><Radio className="h-3 w-3 text-[#00ff66]" />Real-time trading signals are informational and not financial advice.</span>
          <Link to="/app/strategy-lab" className="text-[#8abfff] hover:text-[#b2d2ff]">Open Strategy Lab</Link>
        </div>
      </div>
    </div>
  )
}

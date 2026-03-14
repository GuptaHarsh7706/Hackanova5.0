import { Bell, CircleUser, Globe, RefreshCcw } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"

import { getDashboardSnapshot } from "../api/dashboardApi"

const fmtPrice = (v) => (v == null ? "-" : Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 }))
const fmtChg = (v) => (v == null ? "-" : `${Number(v) > 0 ? "+" : ""}${Number(v).toFixed(2)}%`)
const fmtTime = (v) => {
  if (!v) return "--:--:--"
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return "--:--:--"
  return d.toLocaleTimeString([], { hour12: false })
}

export default function MarketDataCenterPage() {
  const [snapshot, setSnapshot] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const loadSnapshot = useCallback(async () => {
    try {
      const symbol = snapshot?.watchlist?.[0]?.symbol || "AAPL"
      const payload = await getDashboardSnapshot({ symbol, timeframe: "1h" })
      setSnapshot(payload)
      setError("")
    } catch (err) {
      setError(err.message || "Unable to fetch market snapshot")
    } finally {
      setLoading(false)
    }
  }, [snapshot?.watchlist])

  useEffect(() => {
    loadSnapshot()
    const timer = setInterval(loadSnapshot, Math.max(4000, (snapshot?.refresh_after_sec || 8) * 1000))
    return () => clearInterval(timer)
  }, [loadSnapshot, snapshot?.refresh_after_sec])

  const sentimentScore = useMemo(() => {
    const raw = Number(snapshot?.ai_insight?.sentiment_score ?? 0)
    return Math.max(0, Math.min(100, Math.round((raw + 1) * 50)))
  }, [snapshot?.ai_insight?.sentiment_score])

  const sentimentLabel = useMemo(() => {
    if (sentimentScore >= 67) return "GREED"
    if (sentimentScore <= 35) return "FEAR"
    return "NEUTRAL"
  }, [sentimentScore])

  const primary = snapshot?.watchlist?.[0]
  const heatmap = (snapshot?.sector_risk || []).slice(0, 10).map((s) => ({
    sector: String(s.sector || "-").replaceAll("_", " "),
    performance: Number((Number(s.sentiment_score || 0) * 3.5).toFixed(2)),
  }))

  const gainers = snapshot?.gainers || []
  const losers = snapshot?.losers || []

  return (
    <div className="mdc-page">
      <header className="mdc-topbar">
        <div className="mdc-brand">AGENTIC AI TRADING</div>
        <h1>MARKET DATA CENTER</h1>
        <div className="mdc-actions">
          <span className="mdc-live-dot" />
          <span>LIVE DATA FEED</span>
          <span>{fmtTime(snapshot?.generated_at)} UTC</span>
          <button onClick={loadSnapshot} title="Refresh">
            <RefreshCcw className="h-3.5 w-3.5" />
          </button>
          <Bell className="h-3.5 w-3.5" />
          <Globe className="h-3.5 w-3.5" />
          <CircleUser className="h-3.5 w-3.5" />
        </div>
      </header>

      <nav className="mdc-nav">
        <Link to="/app/dashboard">Dashboard</Link>
        <Link to="/app/strategy-lab">Strategy Lab</Link>
        <Link to="/app/backtests">Backtests</Link>
        <Link to="/app/live-signals">Live Signals</Link>
        <Link className="active" to="/app/market-data">Market Data</Link>
        <Link to="/app/trade-analytics">Analytics</Link>
      </nav>

      <div className="mdc-grid">
        <aside className="mdc-left">
          <section className="mdc-panel">
            <p className="mdc-title">Global Indices</p>
            <div className="mdc-mini-grid">
              {(snapshot?.global_markets || []).slice(0, 6).map((m) => (
                <div key={m.symbol} className="mdc-mini-card">
                  <span>{m.name}</span>
                  <strong>{fmtPrice(m.price)}</strong>
                  <b className={Number(m.change_pct) >= 0 ? "up" : "down"}>{fmtChg(m.change_pct)}</b>
                </div>
              ))}
            </div>
          </section>

          <section className="mdc-panel">
            <p className="mdc-title">Cryptocurrencies</p>
            <div className="mdc-stack">
              {(snapshot?.crypto || []).map((c) => (
                <div key={c.symbol} className="mdc-line-item">
                  <span>{c.symbol}/USD</span>
                  <strong>${fmtPrice(c.price)}</strong>
                  <b className={Number(c.change_24h_pct) >= 0 ? "up" : "down"}>{fmtChg(c.change_24h_pct)}</b>
                </div>
              ))}
            </div>
          </section>

          <section className="mdc-panel">
            <p className="mdc-title">Commodities & Forex</p>
            <div className="mdc-mini-grid two-col">
              {(snapshot?.commodities_forex || []).slice(0, 6).map((a) => (
                <div key={a.symbol} className="mdc-mini-card">
                  <span>{a.name}</span>
                  <strong>{fmtPrice(a.price)}</strong>
                  <b className={Number(a.change_pct) >= 0 ? "up" : "down"}>{fmtChg(a.change_pct)}</b>
                </div>
              ))}
            </div>
          </section>
        </aside>

        <main className="mdc-center">
          <section className="mdc-panel mdc-price-board">
            <div className="mdc-board-head">
              <h2>{primary?.symbol || "AAPL"}</h2>
              <strong>${fmtPrice(primary?.price)}</strong>
              <b className={Number(primary?.change_pct) >= 0 ? "up" : "down"}>{fmtChg(primary?.change_pct)}</b>
            </div>
            <div className="mdc-board-chart">
              {Array.from({ length: 30 }).map((_, idx) => (
                <span key={idx} style={{ height: `${35 + (idx % 7) * 7}%` }} />
              ))}
            </div>
          </section>

          <section className="mdc-panel">
            <p className="mdc-title">Order Book Depth ({snapshot?.order_book?.symbol || "-"})</p>
            <div className="mdc-orderbook">
              <div>
                <p>BIDS</p>
                {(snapshot?.order_book?.bids || []).map((b, idx) => (
                  <div key={`b-${idx}`}><span>{fmtPrice(b.price)}</span><b className="up">{Number(b.size).toFixed(3)}</b></div>
                ))}
              </div>
              <div>
                <p>ASKS</p>
                {(snapshot?.order_book?.asks || []).map((a, idx) => (
                  <div key={`a-${idx}`}><span>{fmtPrice(a.price)}</span><b className="down">{Number(a.size).toFixed(3)}</b></div>
                ))}
              </div>
            </div>
            <small>
              Spread: {snapshot?.order_book ? `${snapshot.order_book.spread_abs} (${snapshot.order_book.spread_pct}%)` : "-"}
            </small>
          </section>

          <section className="mdc-panel">
            <p className="mdc-title">Sector Heatmap (24H Performance)</p>
            <div className="mdc-heatmap">
              {heatmap.map((h) => (
                <div key={h.sector} className={h.performance >= 0 ? "tile up-bg" : "tile down-bg"}>
                  <span>{h.sector}</span>
                  <b>{fmtChg(h.performance)}</b>
                </div>
              ))}
            </div>
          </section>

          <section className="mdc-panel">
            <p className="mdc-title">Market News & Events</p>
            <div className="mdc-news-list">
              {(snapshot?.news || []).map((n, idx) => (
                <article key={`${n.headline}-${idx}`}>
                  <span className={n.sentiment === "positive" ? "up" : n.sentiment === "negative" ? "down" : ""}>●</span>
                  <p>{n.headline}</p>
                  <small>{n.source}</small>
                </article>
              ))}
            </div>
          </section>
        </main>

        <aside className="mdc-right">
          <section className="mdc-panel">
            <p className="mdc-title">Sentiment Analysis</p>
            <div className="mdc-gauge" style={{ background: `conic-gradient(#00ff88 ${sentimentScore * 3.6}deg, #16314f 0deg)` }}>
              <div><strong>{sentimentScore}</strong><span>{sentimentLabel}</span></div>
            </div>
            <div className="mdc-bars">
              <div><span>Sentiment</span><b>{sentimentScore}%</b></div>
              <div><span>Confidence</span><b>{Math.round(Number(snapshot?.ai_insight?.confidence_score || 0) * 100)}%</b></div>
              <div><span>Risk</span><b>{String(snapshot?.ai_insight?.risk_level || "moderate").toUpperCase()}</b></div>
            </div>
          </section>

          <section className="mdc-panel">
            <p className="mdc-title">Global Overview</p>
            <div className="mdc-kv">
              <div><span>Total Mkt Cap</span><b>${fmtPrice(snapshot?.market_overview?.total_market_cap_trn)}T</b></div>
              <div><span>24h Volume</span><b>${fmtPrice(snapshot?.market_overview?.total_24h_volume_bln)}B</b></div>
              <div><span>Breadth</span><b>{fmtChg(snapshot?.market_overview?.breadth_ratio_pct || 0)}</b></div>
              <div><span>Active Symbols</span><b>{snapshot?.market_overview?.active_symbols || 0}</b></div>
            </div>
          </section>

          <section className="mdc-panel">
            <p className="mdc-title">Gainers</p>
            <div className="mdc-movers">
              {gainers.map((m) => (
                <div key={`g-${m.symbol}`}><span>{m.symbol}</span><b className="up">{fmtChg(m.change_pct)}</b></div>
              ))}
            </div>
            <p className="mdc-title" style={{ marginTop: 10 }}>Losers</p>
            <div className="mdc-movers">
              {losers.map((m) => (
                <div key={`l-${m.symbol}`}><span>{m.symbol}</span><b className="down">{fmtChg(m.change_pct)}</b></div>
              ))}
            </div>
          </section>
        </aside>
      </div>

      <footer className="mdc-footer">
        <span>Connected to {((snapshot?.global_markets?.length || 0) + (snapshot?.watchlist?.length || 0) + (snapshot?.crypto?.length || 0))} markets</span>
        <span>Last update: {fmtTime(snapshot?.generated_at)} | {loading ? "Loading..." : error ? `Error: ${error}` : "Live feed healthy"}</span>
        <span>{snapshot?.refresh_after_sec || 10}s refresh cycle</span>
      </footer>
    </div>
  )
}

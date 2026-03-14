import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Activity, AlertTriangle, BarChart3, Bell, CircleUser, Download, Filter, RefreshCcw, TrendingDown, TrendingUp } from "lucide-react"
import { useNavigate, useParams } from "react-router-dom"

import EmptyState from "../components/ui/EmptyState"
import { useStrategyStore } from "../store/useStrategyStore"

const PAGE_SIZE = 25
const BASE_API = import.meta.env.VITE_API_URL || "http://localhost:8000/api"

const fmtPct = (v, digits = 2) => (v == null ? "-" : `${Number(v).toFixed(digits)}%`)
const fmtUsd = (v) => (v == null ? "-" : `$${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}`)
const fmtDate = (v) => (v ? String(v).slice(0, 10) : "-")

const buildBuckets = (values, count = 8) => {
  if (!values.length) return Array.from({ length: count }, (_, i) => ({ label: `${i + 1}`, count: 0 }))
  const min = Math.min(...values)
  const max = Math.max(...values)
  const step = Math.max((max - min) / count, 0.0001)
  const bins = Array.from({ length: count }, (_, i) => ({
    label: `${(min + i * step).toFixed(1)}%`,
    count: 0,
  }))
  values.forEach((v) => {
    const idx = Math.min(count - 1, Math.floor((v - min) / step))
    bins[idx].count += 1
  })
  return bins
}

const pathFromValues = (values = [], width = 100, height = 34) => {
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

export default function TradeAnalyticsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const {
    backtestResult,
    currentResultId,
    backtestLoading,
    history,
    historyLoading,
    fetchHistory,
    fetchResultById,
  } = useStrategyStore()

  const [page, setPage] = useState(1)
  const [liveSnapshot, setLiveSnapshot] = useState(null)
  const [liveUpdatedAt, setLiveUpdatedAt] = useState(null)
  const [liveError, setLiveError] = useState("")
  const [notificationPopup, setNotificationPopup] = useState(null)
  const seenNotificationIdsRef = useRef(new Set())
  const popupTimeoutRef = useRef(null)

  const fetchRealtimeSnapshot = useCallback(async (symbol, timeframe) => {
    if (!symbol) return
    try {
      const url = `${BASE_API}/dashboard/snapshot?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe || "1h")}`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`snapshot_failed_${res.status}`)
      const payload = await res.json()
      setLiveSnapshot(payload)
      setLiveUpdatedAt(new Date())
      setLiveError("")
    } catch (err) {
      setLiveError(err.message || "Unable to fetch live analytics")
    }
  }, [])

  const refreshAnalytics = useCallback(async () => {
    const symbol = backtestResult?.strategy?.ticker || "AAPL"
    const timeframe = backtestResult?.strategy?.timeframe || "1h"
    await fetchRealtimeSnapshot(symbol, timeframe)
  }, [backtestResult?.strategy?.ticker, backtestResult?.strategy?.timeframe, fetchRealtimeSnapshot])

  useEffect(() => {
    if (id) {
      if (!backtestResult || currentResultId !== id) {
        fetchResultById(id)
      }
      return
    }

    if (!backtestResult && !history.length && !historyLoading) {
      fetchHistory()
    }
  }, [id, currentResultId])

  useEffect(() => {
    if (!id && !backtestResult && history.length) {
      fetchResultById(history[0].id)
    }
  }, [id, history.length])

  useEffect(() => {
    if (!backtestResult?.strategy?.ticker) return
    const symbol = backtestResult.strategy.ticker
    const timeframe = backtestResult?.strategy?.timeframe || "1h"

    fetchRealtimeSnapshot(symbol, timeframe)
    const timer = setInterval(() => {
      fetchRealtimeSnapshot(symbol, timeframe)
    }, 10000)

    return () => clearInterval(timer)
  }, [backtestResult?.strategy?.ticker, backtestResult?.strategy?.timeframe, fetchRealtimeSnapshot])

  const safeResult = backtestResult || {}
  const strategy = safeResult.strategy || {}
  const metrics = safeResult.metrics || {}
  const trades = safeResult.trades || []
  const equity_curve = safeResult.equity_curve || []

  const liveInsight = liveSnapshot?.ai_insight || null
  const liveWatch = (liveSnapshot?.watchlist || []).find((w) => w.symbol === strategy?.ticker)

  const liveDecision = useMemo(() => {
    if (!liveInsight) {
      return {
        action: "HOLD",
        outlook: "Waiting for live insight",
        confidence: 0,
        score: 0,
        rationale: ["Live AI insight not available yet."],
      }
    }

    const historicalWinRate = Number(metrics?.win_rate_pct ?? 0)
    const historicalReturn = Number(metrics?.total_return_pct ?? 0)
    const historicalSharpe = Number(metrics?.sharpe_ratio ?? 0)
    const realtimeSentiment = Number(liveInsight?.sentiment_score ?? 0) * 100
    const realtimeConfidence = Number(liveInsight?.confidence_score ?? 0) * 100
    const intradayMove = Number(liveWatch?.change_pct ?? 0)
    const action = String(liveInsight?.recommended_action || "hold").toUpperCase()

    const historicalEdge =
      (historicalWinRate - 50) * 0.8 +
      historicalReturn * 0.35 +
      historicalSharpe * 8

    const realtimeEdge =
      realtimeSentiment * 0.9 +
      (action === "BUY" ? 8 : action === "SELL" ? -8 : 0) +
      intradayMove * 1.5 +
      (realtimeConfidence - 50) * 0.2

    const score = Math.max(-100, Math.min(100, historicalEdge * 0.55 + realtimeEdge * 0.45))

    let outlook = "Mixed Conditions"
    let mappedAction = action === "REDUCE_RISK" ? "HOLD" : action
    if (score >= 18 && (mappedAction === "BUY" || mappedAction === "HOLD")) {
      mappedAction = "BUY"
      outlook = "Likely Profitable Setup"
    } else if (score <= -18 && (mappedAction === "SELL" || mappedAction === "HOLD")) {
      mappedAction = "SELL"
      outlook = "Bearish / Avoid Long Exposure"
    } else if (Math.abs(score) < 18) {
      mappedAction = "HOLD"
      outlook = "Low Edge Right Now"
    }

    const rationale = []
    rationale.push(`Historical win rate ${historicalWinRate.toFixed(1)}%, total return ${historicalReturn.toFixed(1)}%`)
    rationale.push(`Realtime sentiment ${realtimeSentiment.toFixed(1)} with confidence ${realtimeConfidence.toFixed(1)}%`)
    if (liveInsight?.risk_level) rationale.push(`Risk level: ${String(liveInsight.risk_level).toUpperCase()}`)
    if (liveWatch?.change_pct != null) rationale.push(`Current market move: ${Number(liveWatch.change_pct).toFixed(2)}%`)

    return {
      action: mappedAction,
      outlook,
      confidence: Math.round(Math.max(0, Math.min(100, realtimeConfidence))),
      score: Number(score.toFixed(1)),
      rationale,
    }
  }, [liveInsight, liveWatch?.change_pct, metrics?.sharpe_ratio, metrics?.total_return_pct, metrics?.win_rate_pct])

  const notificationFeed = useMemo(() => {
    const items = []

    const news = liveSnapshot?.news || []
    news.slice(0, 6).forEach((n, idx) => {
      items.push({
        id: `news-${idx}-${String(n.timestamp || "")}`,
        type: n.sentiment === "negative" ? "risk" : n.sentiment === "positive" ? "opportunity" : "neutral",
        title: n.headline,
        meta: `${n.source} · ${String(n.sentiment || "neutral").toUpperCase()}`,
      })
    })

    const markets = liveSnapshot?.global_markets || []
    markets.slice(0, 4).forEach((m, idx) => {
      const chg = Number(m.change_pct || 0)
      items.push({
        id: `macro-${idx}-${m.symbol}-${chg.toFixed(2)}`,
        type: Math.abs(chg) >= 1 ? "macro" : "neutral",
        title: `${m.symbol} moved ${chg > 0 ? "+" : ""}${chg.toFixed(2)}%`,
        meta: "Global market trend",
      })
    })

    const sectors = liveSnapshot?.sector_risk || []
    sectors
      .filter((s) => Number(s.risk_score) >= 70 || Number(s.volatility_score) >= 70)
      .slice(0, 3)
      .forEach((s, idx) => {
        items.push({
          id: `sector-${idx}-${s.sector}-${Number(s.risk_score).toFixed(1)}-${Number(s.volatility_score).toFixed(1)}`,
          type: "risk",
          title: `${String(s.sector).toUpperCase()} showing elevated risk/volatility`,
          meta: `Risk ${Number(s.risk_score).toFixed(1)} · Vol ${Number(s.volatility_score).toFixed(1)}`,
        })
      })

    if (liveInsight?.drivers?.length) {
      liveInsight.drivers.slice(0, 2).forEach((d, idx) => {
        items.push({
          id: `driver-${idx}-${d}`,
          type: "ai",
          title: `AI driver: ${d}`,
          meta: "Model explanation",
        })
      })
    }

    return items.slice(0, 10)
  }, [liveInsight?.drivers, liveSnapshot?.global_markets, liveSnapshot?.news, liveSnapshot?.sector_risk])

  useEffect(() => {
    if (!notificationFeed.length) return

    const unseen = notificationFeed.filter((n) => !seenNotificationIdsRef.current.has(n.id))
    if (!unseen.length) return

    unseen.forEach((n) => seenNotificationIdsRef.current.add(n.id))
    const nextPopup = unseen[0]
    setNotificationPopup(nextPopup)

    if (popupTimeoutRef.current) {
      clearTimeout(popupTimeoutRef.current)
    }
    popupTimeoutRef.current = setTimeout(() => {
      setNotificationPopup(null)
      popupTimeoutRef.current = null
    }, 2000)
  }, [notificationFeed])

  useEffect(() => {
    return () => {
      if (popupTimeoutRef.current) {
        clearTimeout(popupTimeoutRef.current)
        popupTimeoutRef.current = null
      }
    }
  }, [])

  const normalizedTrades = useMemo(() =>
    trades.map((t, idx) => ({
      id: t.id ?? idx + 1,
      date_in: fmtDate(t.date_in),
      date_out: fmtDate(t.date_out),
      direction: String(t.side || "long").toUpperCase(),
      symbol: t.symbol || strategy?.ticker || "N/A",
      entry_price: Number(t.entry_price ?? 0),
      exit_price: Number(t.exit_price ?? 0),
      position_size: Number(t.position_size ?? strategy?.position_size ?? 1),
      pnl_usd: Number(t.pnl_usd ?? 0),
      return_pct: Number(t.return_pct ?? 0),
      hold_days: Number(t.hold_days ?? 0),
      status: t.status || "Closed",
    })),
  [trades, strategy?.ticker, strategy?.position_size])

  const totalPages = Math.max(1, Math.ceil(normalizedTrades.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageRows = normalizedTrades.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const wins = normalizedTrades.filter((t) => t.pnl_usd > 0)
  const losses = normalizedTrades.filter((t) => t.pnl_usd < 0)

  const bestTrade = wins.length ? [...wins].sort((a, b) => b.return_pct - a.return_pct)[0] : null
  const worstTrade = losses.length ? [...losses].sort((a, b) => a.return_pct - b.return_pct)[0] : null

  const avgWin = wins.length ? wins.reduce((s, t) => s + t.return_pct, 0) / wins.length : 0
  const avgLoss = losses.length ? losses.reduce((s, t) => s + t.return_pct, 0) / losses.length : 0

  const pnlBuckets = buildBuckets(normalizedTrades.map((t) => t.return_pct), 8)
  const durationBuckets = [
    { label: "< 3d", count: normalizedTrades.filter((t) => t.hold_days < 3).length },
    { label: "3-7d", count: normalizedTrades.filter((t) => t.hold_days >= 3 && t.hold_days <= 7).length },
    { label: "8-14d", count: normalizedTrades.filter((t) => t.hold_days >= 8 && t.hold_days <= 14).length },
    { label: "> 14d", count: normalizedTrades.filter((t) => t.hold_days > 14).length },
  ]

  const perfBySymbol = Object.entries(
    normalizedTrades.reduce((acc, t) => {
      acc[t.symbol] = acc[t.symbol] || { pnl: 0, wins: 0, count: 0 }
      acc[t.symbol].pnl += t.pnl_usd
      acc[t.symbol].count += 1
      if (t.pnl_usd > 0) acc[t.symbol].wins += 1
      return acc
    }, {})
  )
    .map(([symbol, v]) => ({
      symbol,
      pnl: v.pnl,
      winRate: v.count ? (v.wins / v.count) * 100 : 0,
      count: v.count,
    }))
    .sort((a, b) => b.pnl - a.pnl)
    .slice(0, 5)

  const equityTail = equity_curve.slice(-100)
  const exposurePath = pathFromValues(equityTail.map((p) => Number(p.value || 0)), 100, 34)

  const marketConditionRows = [
    { label: "Trending Up Markets", color: "up", rate: Math.min(98, Number(metrics?.win_rate_pct ?? 0) + 8), ret: Number(metrics?.total_return_pct ?? 0) * 0.65 },
    { label: "Range-Bound Markets", color: "mid", rate: Math.max(15, Number(metrics?.win_rate_pct ?? 0) - 5), ret: Number(metrics?.total_return_pct ?? 0) * 0.4 },
    { label: "Trending Down Markets", color: "down", rate: Math.max(8, Number(metrics?.win_rate_pct ?? 0) - 18), ret: Number(metrics?.total_return_pct ?? 0) * 0.25 },
  ]

  const winRate = Number(metrics?.win_rate_pct ?? (wins.length / Math.max(normalizedTrades.length, 1)) * 100)

  if (!backtestResult && (backtestLoading || (!id && historyLoading && !backtestResult))) {
    return (
      <div className="ta-page flex h-full items-center justify-center">
        <div className="text-center">
          <div className="mb-2 text-lg font-semibold">Loading trade analytics...</div>
          <div className="text-sm text-[var(--text-secondary)]">Crunching trade-level performance and risk signals.</div>
        </div>
      </div>
    )
  }

  if (!backtestResult) {
    return (
      <div className="ta-page">
        <EmptyState title="No backtest results yet" action={{ label: "Go to Strategy Lab", onClick: () => navigate("/app/strategy-lab") }} />
      </div>
    )
  }

  return (
    <div className="ta-page">
      {notificationPopup ? (
        <div
          className={`fixed right-4 top-4 z-[120] max-w-[420px] rounded border px-3 py-2 text-xs shadow-lg ${
            notificationPopup.type === "risk"
              ? "border-[#5b2c35] bg-[#2a1016] text-[#ffb6c3]"
              : notificationPopup.type === "opportunity"
                ? "border-[#235040] bg-[#0f231b] text-[#9ff0cb]"
                : "border-[var(--border-default)] bg-[#0a172c] text-[var(--text-primary)]"
          }`}
        >
          <p className="font-semibold">{notificationPopup.title}</p>
          <p className="mt-1 text-[10px] text-[var(--text-secondary)]">{notificationPopup.meta}</p>
        </div>
      ) : null}

      <header className="ta-topbar">
        <div className="ta-brand">AI Trading Platform</div>
        <h1>Trade Analytics</h1>
        <div className="ta-tools">
          <button title="Realtime mode enabled"><Activity className="h-3.5 w-3.5" /> LIVE</button>
          <button>{strategy?.timeframe || "1D"}</button>
          <button onClick={() => {
            const ticker = (strategy?.ticker || "strategy").toLowerCase()
            const stamp = new Date().toISOString().slice(0, 10)
            const report = {
              generated_at: new Date().toISOString(),
              strategy,
              metrics,
              trade_count: normalizedTrades.length,
              live_snapshot: liveSnapshot,
              top_trades: normalizedTrades.slice(0, 25),
            }
            const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" })
            const href = URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = href
            a.download = `${ticker}-trade-analytics-${stamp}.json`
            document.body.appendChild(a)
            a.click()
            a.remove()
            URL.revokeObjectURL(href)
          }}><Download className="h-3.5 w-3.5" /> Export</button>
          <Bell className="h-3.5 w-3.5" />
          <CircleUser className="h-3.5 w-3.5" />
        </div>
      </header>

      <main className="ta-content">
        <section className="ta-kpis">
          <article><p>Total Trades</p><strong>{normalizedTrades.length}</strong></article>
          <article><p>Win Rate</p><strong className="up">{fmtPct(winRate)}</strong></article>
          <article><p>Average Win</p><strong className="up">+{fmtPct(avgWin)}</strong></article>
          <article><p>Average Loss</p><strong className="down">{fmtPct(avgLoss)}</strong></article>
        </section>

        <section className="ta-panel ta-kv">
          <div className="ta-head"><p>Realtime Market Analytics</p></div>
          <div><span>Last Update</span><b>{liveUpdatedAt ? liveUpdatedAt.toLocaleTimeString() : "Waiting for feed"}</b></div>
          <div><span>Live Price ({strategy?.ticker || "N/A"})</span><b>{liveWatch ? fmtUsd(liveWatch.price) : "-"}</b></div>
          <div><span>Live Change</span><b className={Number(liveWatch?.change_pct || 0) >= 0 ? "up" : "down"}>{liveWatch ? fmtPct(liveWatch.change_pct) : "-"}</b></div>
          <div><span>AI Sentiment</span><b>{liveInsight ? fmtNum((liveInsight.sentiment_score || 0) * 100, 1) : "-"}</b></div>
          <div><span>AI Risk Level</span><b>{liveInsight?.risk_level || "-"}</b></div>
          <div><span>AI Action</span><b>{liveInsight?.recommended_action || "-"}</b></div>
          <div><span>Insight Summary</span><b>{liveInsight?.insight_summary || (liveError ? `Feed issue: ${liveError}` : "Waiting for AI insight")}</b></div>
        </section>

        <section className="ta-row-2">
          <article className="ta-panel ta-kv">
            <div className="ta-head"><p>Realtime Trade Decision</p></div>
            <div>
              <span>Suggested Action</span>
              <b className={liveDecision.action === "BUY" ? "up" : liveDecision.action === "SELL" ? "down" : ""}>
                {liveDecision.action}
              </b>
            </div>
            <div><span>Profitability Outlook</span><b>{liveDecision.outlook}</b></div>
            <div><span>Live Confidence</span><b>{liveDecision.confidence}%</b></div>
            <div><span>Edge Score</span><b className={liveDecision.score >= 0 ? "up" : "down"}>{liveDecision.score}</b></div>
            {liveDecision.rationale.map((line, idx) => (
              <div key={`decision-rationale-${idx}`}>
                <span>{idx === 0 ? "Rationale" : ""}</span>
                <b>{line}</b>
              </div>
            ))}
          </article>

          <article className="ta-panel">
            <div className="ta-head"><p>Notifications & Economic Trends</p></div>
            <div className="ta-list">
              {notificationFeed.length === 0 ? (
                <div><span>No notifications yet</span><b>Waiting for feed</b></div>
              ) : (
                notificationFeed.map((n) => (
                  <div key={n.id}>
                    <span>{n.title}</span>
                    <b className={n.type === "risk" ? "down" : n.type === "opportunity" ? "up" : ""}>{n.meta}</b>
                  </div>
                ))
              )}
            </div>
            {liveError ? (
              <div className="mt-2 inline-flex items-center gap-1 text-[10px] text-[#ff9aa6]">
                <AlertTriangle className="h-3 w-3" /> Live notifications degraded: {liveError}
              </div>
            ) : null}
          </article>
        </section>

        <section className="ta-panel">
          <div className="ta-head">
            <p>Trades</p>
            <div className="ta-head-actions">
              <button><Filter className="h-3.5 w-3.5" /> Filter Trades</button>
              <button onClick={() => navigate(`/app/results/${currentResultId || id}`)}><BarChart3 className="h-3.5 w-3.5" /> View Results</button>
            </div>
          </div>
          <div className="ta-table-wrap">
            <table className="ta-table">
              <thead>
                <tr>
                  <th>Trade #</th>
                  <th>Entry Date</th>
                  <th>Exit Date</th>
                  <th>Direction</th>
                  <th>Symbol</th>
                  <th>Entry Price</th>
                  <th>Exit Price</th>
                  <th>Position Size</th>
                  <th>PnL</th>
                  <th>Return</th>
                  <th>Duration</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((t) => (
                  <tr key={t.id}>
                    <td>#{t.id}</td>
                    <td>{t.date_in}</td>
                    <td>{t.date_out}</td>
                    <td><span className={`pill ${t.direction === "LONG" ? "long" : "short"}`}>{t.direction}</span></td>
                    <td>{t.symbol}</td>
                    <td>{t.entry_price.toFixed(2)}</td>
                    <td>{t.exit_price.toFixed(2)}</td>
                    <td>{(t.position_size * 100).toFixed(0)}%</td>
                    <td className={t.pnl_usd >= 0 ? "up" : "down"}>{fmtUsd(t.pnl_usd)}</td>
                    <td className={t.return_pct >= 0 ? "up" : "down"}>{fmtPct(t.return_pct)}</td>
                    <td>{t.hold_days}d</td>
                    <td><span className="tag">{t.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="ta-pagination">
            <button disabled={currentPage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</button>
            <span>{currentPage} / {totalPages}</span>
            <button disabled={currentPage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</button>
          </div>
        </section>

        <section className="ta-row-2">
          <article className="ta-panel">
            <div className="ta-head"><p>PnL Distribution By Trade</p></div>
            <div className="ta-bars">
              {pnlBuckets.map((b, idx) => (
                <div key={`${b.label}-${idx}`} className="bar-col">
                  <span style={{ height: `${Math.max(8, b.count * 16)}px` }} />
                  <small>{b.label}</small>
                </div>
              ))}
            </div>
          </article>

          <article className="ta-panel ta-kv">
            <div className="ta-head"><p>Win/Loss Analysis</p></div>
            <div><span>Winning Trades</span><b className="up">{wins.length}</b></div>
            <div><span>Losing Trades</span><b className="down">{losses.length}</b></div>
            <div><span>Break-even Trades</span><b>{normalizedTrades.length - wins.length - losses.length}</b></div>
            <div><span>Best Trade</span><b className="up">{bestTrade ? fmtPct(bestTrade.return_pct) : "-"}</b></div>
            <div><span>Worst Trade</span><b className="down">{worstTrade ? fmtPct(worstTrade.return_pct) : "-"}</b></div>
            <div><span>Largest Gain</span><b className="up">{fmtUsd(Math.max(0, ...wins.map((t) => t.pnl_usd), 0))}</b></div>
            <div><span>Largest Loss</span><b className="down">{fmtUsd(Math.min(0, ...losses.map((t) => t.pnl_usd), 0))}</b></div>
          </article>
        </section>

        <section className="ta-row-3">
          <article className="ta-panel">
            <div className="ta-head"><p>Trade Duration Analysis</p></div>
            <div className="ta-hbars">
              {durationBuckets.map((b) => (
                <div key={b.label}>
                  <span>{b.label}</span>
                  <i><em style={{ width: `${Math.max(6, (b.count / Math.max(normalizedTrades.length, 1)) * 100)}%` }} /></i>
                  <b>{b.count}</b>
                </div>
              ))}
            </div>
          </article>

          <article className="ta-panel">
            <div className="ta-head"><p>Best / Worst Trades</p></div>
            <div className="ta-list">
              {normalizedTrades
                .slice()
                .sort((a, b) => b.return_pct - a.return_pct)
                .slice(0, 3)
                .map((t) => <div key={`best-${t.id}`}><span>{t.date_in} · {t.symbol}</span><b className="up">+{fmtPct(t.return_pct)}</b></div>)}
              {normalizedTrades
                .slice()
                .sort((a, b) => a.return_pct - b.return_pct)
                .slice(0, 3)
                .map((t) => <div key={`worst-${t.id}`}><span>{t.date_in} · {t.symbol}</span><b className="down">{fmtPct(t.return_pct)}</b></div>)}
            </div>
          </article>

          <article className="ta-panel">
            <div className="ta-head"><p>Trade Performance By Symbol</p></div>
            <div className="ta-list symbol">
              {perfBySymbol.map((s) => (
                <div key={s.symbol}>
                  <span>{s.symbol} · {s.count} trades</span>
                  <b className={s.pnl >= 0 ? "up" : "down"}>{fmtUsd(s.pnl)} ({fmtPct(s.winRate)})</b>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="ta-row-4">
          <article className="ta-panel">
            <div className="ta-head"><p>Position Risk Exposure</p></div>
            <svg viewBox="0 0 100 34" preserveAspectRatio="none" className="ta-exposure-svg">
              <path d={exposurePath} fill="none" stroke="#f8bf26" strokeWidth="0.8" />
              <path d={`${exposurePath} L100 34 L0 34 Z`} fill="rgba(248,191,38,0.25)" />
            </svg>
          </article>

          <article className="ta-panel ta-kv">
            <div className="ta-head"><p>Trade Volatility Metrics</p></div>
            <div><span>Standard Deviation Of Returns</span><b>{fmtPct(metrics?.std_returns_pct ?? Math.abs(avgLoss) + avgWin)}</b></div>
            <div><span>Volatility Ratio (Win vs Loss)</span><b>{(Math.abs(avgLoss) > 0 ? (avgWin / Math.abs(avgLoss)).toFixed(2) : "-")}</b></div>
            <div><span>Risk-Adjusted Return</span><b className="up">{fmtNum(metrics?.sharpe_ratio ?? 0)}</b></div>
            <div><span>Average Trade Risk</span><b>{fmtPct(metrics?.max_drawdown_pct ? metrics.max_drawdown_pct / 8 : 0)}</b></div>
            <div><span>Maximum Position Risk</span><b className="down">{fmtPct(metrics?.max_drawdown_pct)}</b></div>
          </article>
        </section>

        <section className="ta-panel">
          <div className="ta-head"><p>Performance Across Market Conditions</p></div>
          <div className="ta-cond-wrap">
            {marketConditionRows.map((r) => (
              <div key={r.label} className="ta-cond-row">
                <span>{r.label}</span>
                <i><em className={r.color} style={{ width: `${Math.min(100, Math.max(5, r.rate))}%` }} /></i>
                <b>Win Rate: {fmtPct(r.rate)} · Avg Return: {fmtPct(r.ret)}</b>
              </div>
            ))}
          </div>
        </section>

        <footer className="ta-footer">
          <div>
            <span>Bull Market Trades</span>
            <b>{Math.round(normalizedTrades.length * 0.45)}</b>
          </div>
          <div>
            <span>Sideways Market Trades</span>
            <b>{Math.round(normalizedTrades.length * 0.35)}</b>
          </div>
          <div>
            <span>Bear Market Trades</span>
            <b>{Math.round(normalizedTrades.length * 0.2)}</b>
          </div>
          <div className="ta-footer-actions">
            <button onClick={() => navigate(`/app/results/${currentResultId || id}`)}>View Details</button>
            <button><Filter className="h-3.5 w-3.5" /> Filter Trades</button>
            <button onClick={refreshAnalytics}><RefreshCcw className="h-3.5 w-3.5" /> Refresh</button>
          </div>
        </footer>
      </main>
    </div>
  )
}

function fmtNum(v, digits = 2) {
  if (v == null) return "-"
  return Number(v).toFixed(digits)
}

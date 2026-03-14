import { Bell, CircleUser, Globe, Settings2 } from "lucide-react"
import { Link } from "react-router-dom"
import { useStrategyStore } from "../store/useStrategyStore"

export default function ChatPage() {
  const parseDetails = useStrategyStore((s) => s.parseDetails)
  const currentStrategy = useStrategyStore((s) => s.currentStrategy)
  const parseCanRun = useStrategyStore((s) => s.parseCanRun)

  const watchlist = [
    ["AAPL", "185.11", "+0.82%"],
    ["MSFT", "403.79", "+1.12%"],
    ["GOOGL", "176.24", "-0.27%"],
    ["AMZN", "191.62", "+0.35%"],
    ["TSLA", "228.06", "-1.17%"],
    ["NVDA", "915.42", "+2.41%"],
    ["META", "503.55", "+0.76%"],
    ["JPM", "186.13", "+0.18%"],
  ]

  const forex = [
    ["EUR/USD", "1.0862", "+0.12%"],
    ["GBP/USD", "1.2774", "+0.08%"],
    ["USD/JPY", "149.67", "-0.20%"],
    ["AUD/USD", "0.6612", "+0.14%"],
    ["USD/CNY", "7.1364", "-0.13%"],
  ]

  const commodities = [
    ["Gold", "$2,168.44", "+0.37%"],
    ["Silver", "$23.12", "+1.10%"],
    ["Crude Oil", "$78.36", "-0.33%"],
    ["Natural Gas", "$2.67", "-0.41%"],
  ]

  const marketNews = [
    ["Fed Signals Rate Cuts Could Begin in Q2 2026", "POSITIVE"],
    ["Tech Earnings Beat Expectations, Nasdaq Surges", "POSITIVE"],
    ["Oil Prices Drop 2% on Supply Concerns", "NEGATIVE"],
    ["China GDP Growth Exceeds Forecast at 5.2%", "POSITIVE"],
    ["Banking Sector Faces Regulatory Headwinds", "NEUTRAL"],
  ]

  const aiReadiness = parseDetails?.readiness_score ?? 72
  const aiSummary = parseDetails?.reasoning_summary || "Strong bullish momentum detected above key support levels with mixed macro sentiment."
  const aiSignals = parseDetails?.extracted_signals?.length
    ? parseDetails.extracted_signals
    : [
        "Momentum trend confirms above short MA stack",
        "Volume impulse supports continuation bias",
        "Risk model suggests tighter stop around session low",
        "Breakout RSI profile favors buy-the-dip continuation",
      ]

  const topTape = ["AAPL 185.11 +0.82%", "MSFT 403.79 +1.12%", "GOOGL 176.24 -0.27%", "AMZN 191.62 +0.35%", "TSLA 228.06 -1.17%", "NVDA 915.42 +2.41%", "META 503.55 +0.76%", "JPM 186.13 +0.18%"]

  return (
    <div className="bloom-page min-h-screen">
      <header className="bloom-topbar">
        <div className="bloom-brand">FINTECH</div>
        <nav className="bloom-nav">
          <Link className="active" to="/app/dashboard">Dashboard</Link>
          <Link to="/app/strategy-lab">Strategy Lab</Link>
          <Link to="/app/sandbox">Indicators</Link>
          <Link to="/app/live-signals">Live Signals</Link>
          <Link to="/app/market-data">Market Data</Link>
          <Link to="/app/trade-analytics">Analytics</Link>
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
            <p className="bloom-title">Global Markets</p>
            <div className="bloom-list">
              <div><span>S&P 500</span><span className="up">+1.28%</span></div>
              <div><span>Dow Jones</span><span className="up">+0.95%</span></div>
              <div><span>Nasdaq</span><span className="up">+1.67%</span></div>
              <div><span>FTSE 100</span><span className="down">-0.18%</span></div>
              <div><span>DAX</span><span className="up">+0.44%</span></div>
              <div><span>Nikkei 225</span><span className="down">-0.52%</span></div>
            </div>
          </section>

          <section className="bloom-panel">
            <p className="bloom-title">Watchlist</p>
            <div className="bloom-table">
              <div className="bloom-row bloom-head"><span>Symbol</span><span>Price</span><span>Chg</span></div>
              {watchlist.map(([s, p, c]) => (
                <div key={s} className="bloom-row">
                  <span>{s}</span>
                  <span>{p}</span>
                  <span className={c.startsWith("+") ? "up" : "down"}>{c}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="bloom-panel">
            <p className="bloom-title">Crypto</p>
            {["BTC", "ETH", "BNB", "SOL"].map((symbol, i) => (
              <div key={symbol} className="bloom-asset">
                <div className="flex items-center justify-between text-[10px]">
                  <span>{symbol}</span>
                  <span className="up">+{(2.5 - i * 0.4).toFixed(2)}%</span>
                </div>
                <div className="bloom-bars">
                  {Array.from({ length: 8 }).map((_, idx) => <span key={`${symbol}-${idx}`} style={{ height: `${8 + ((idx + i) % 3) * 2}px` }} />)}
                </div>
              </div>
            ))}
          </section>
        </aside>

        <main className="bloom-center">
          <section className="bloom-panel bloom-chart-panel">
            <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-2">
              <p className="bloom-title">S&P 500 Index</p>
              <div className="flex gap-1 text-[10px]">
                {["1m", "5m", "15m", "1h", "4h", "1d"].map((tf) => (
                  <span key={tf} className={`bloom-chip ${tf === "1h" ? "active" : ""}`}>{tf}</span>
                ))}
              </div>
            </div>
            <div className="bloom-chart-wrap">
              <div className="bloom-bars-plot">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="bloom-bar" style={{ height: `${35 + i * 6 - (i % 3) * 8}%` }} />
                ))}
              </div>
              <svg viewBox="0 0 100 40" className="bloom-line-svg" preserveAspectRatio="none">
                <polyline fill="none" stroke="#15ff62" strokeWidth="1.1" points="0,31 10,27 20,22 30,19 40,17 50,15 60,13 70,11 80,9 90,8 100,6" />
                <polyline fill="none" stroke="#ffd21a" strokeWidth="0.9" points="0,34 10,33 20,31 30,29 40,27 50,25 60,23 70,21 80,19 90,17 100,15" />
              </svg>
            </div>
            <div className="bloom-metrics">
              <div><p>RSI (14)</p><strong>72.4</strong></div>
              <div><p>MACD</p><strong className="up">+26.8</strong></div>
              <div><p>Volume</p><strong>3.1B</strong></div>
            </div>
          </section>

          <section className="bloom-panel">
            <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-2">
              <p className="bloom-title">AI Market Insights</p>
              <span className="text-[10px] text-[var(--text-secondary)]">Sentiment Score</span>
            </div>
            <div className="mt-2 h-1.5 rounded bg-[#152434]">
              <div className="h-full rounded bg-[#00ff66]" style={{ width: `${aiReadiness}%` }} />
            </div>
            <p className="mt-2 text-[11px] text-[var(--text-secondary)]">{aiSummary}</p>
            <ul className="mt-2 space-y-1 text-[11px] text-[var(--text-secondary)]">
              {aiSignals.slice(0, 4).map((line, idx) => (
                <li key={`${line}-${idx}`}>• {line}</li>
              ))}
            </ul>
            <div className="mt-2 text-[10px]">
              <span className={`bloom-chip ${parseCanRun ? "ok" : "warn"}`}>{parseCanRun ? "Strategy Ready" : "Needs Clarification"}</span>
              {currentStrategy?.ticker ? <span className="ml-1 bloom-chip">{currentStrategy.ticker}</span> : null}
              {currentStrategy?.timeframe ? <span className="ml-1 bloom-chip">{currentStrategy.timeframe}</span> : null}
            </div>
          </section>

          <section className="bloom-panel">
            <p className="bloom-title">News Sentiment</p>
            <div className="bloom-news">
              {marketNews.map(([headline, mood]) => (
                <div key={headline} className="bloom-news-row">
                  <span>{headline}</span>
                  <span className={`tag ${mood.toLowerCase()}`}>{mood}</span>
                </div>
              ))}
            </div>
          </section>
        </main>

        <aside className="bloom-right">
          <section className="bloom-panel">
            <p className="bloom-title">Forex</p>
            <div className="bloom-table">
              {forex.map(([pair, px, chg]) => (
                <div key={pair} className="bloom-row">
                  <span>{pair}</span>
                  <span>{px}</span>
                  <span className={chg.startsWith("+") ? "up" : "down"}>{chg}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="bloom-panel">
            <p className="bloom-title">Commodities</p>
            <div className="bloom-table">
              {commodities.map(([name, px, chg]) => (
                <div key={name} className="bloom-row">
                  <span>{name}</span>
                  <span>{px}</span>
                  <span className={chg.startsWith("+") ? "up" : "down"}>{chg}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="bloom-panel">
            <p className="bloom-title">Sector Risk</p>
            <div className="bloom-risk-grid">
              {["low", "mid", "high", "mid", "mid", "low", "high", "low", "mid", "mid", "high", "mid"].map((t, idx) => (
                <span key={idx} className={`risk-${t}`} />
              ))}
            </div>
          </section>
        </aside>
      </div>

      <footer className="bloom-footer-tape">
        <div className="ticker-tape">
          {[...topTape, ...topTape].map((item, idx) => <span key={`${item}-${idx}`} className="ticker-item">{item}</span>)}
        </div>
      </footer>
    </div>
  )
}

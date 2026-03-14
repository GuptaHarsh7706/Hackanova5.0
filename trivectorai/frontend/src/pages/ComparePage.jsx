import { useEffect, useMemo, useState } from "react"
import { Bell, CircleUser, GitCompare, RefreshCcw } from "lucide-react"

import CompareMetricTable from "../components/compare/CompareMetricTable"
import OverlaidChart from "../components/compare/OverlaidChart"
import { useStrategyStore } from "../store/useStrategyStore"

export default function ComparePage() {
  const {
    history,
    fetchHistory,
    compareItems,
    compareLoading,
    fetchCompareItems,
  } = useStrategyStore()
  const [strategyAId, setStrategyAId] = useState("")
  const [strategyBId, setStrategyBId] = useState("")

  useEffect(() => {
    fetchHistory()
  }, [])

  useEffect(() => {
    if (strategyAId && strategyBId) {
      fetchCompareItems([strategyAId, strategyBId])
    }
  }, [strategyAId, strategyBId, fetchCompareItems])

  const options = useMemo(
    () =>
      history.map((h) => ({
        value: h.id,
        label: `${h?.strategy?.ticker || h?.ticker_used || "Unknown"} — ${h.strategy?.entry_rules?.[0]?.indicator || "Strategy"}`,
      })),
    [history],
  )

  const selected = useMemo(() => {
    if (compareItems.length < 2) return null
    const [a, b] = compareItems
    const left = a.results || {}
    const right = b.results || {}
    return {
      a: { label: a.name, total: Number(left.total_return_pct || 0), sharpe: Number(left.sharpe_ratio || 0) },
      b: { label: b.name, total: Number(right.total_return_pct || 0), sharpe: Number(right.sharpe_ratio || 0) },
    }
  }, [compareItems])

  const clearCompare = () => {
    setStrategyAId("")
    setStrategyBId("")
  }

  return (
    <div className="cp-page">
      <header className="cp-topbar">
        <div className="cp-brand">AI Trading Platform</div>
        <h1>Strategy Comparison Console</h1>
        <div className="cp-tools">
          <button><GitCompare className="h-3.5 w-3.5" /> Compare</button>
          <Bell className="h-3.5 w-3.5" />
          <CircleUser className="h-3.5 w-3.5" />
        </div>
      </header>

      <main className="cp-content">
        <section className="cp-panel cp-selectors">
          <div className="cp-head">
            <p>Choose Strategies</p>
            <button onClick={clearCompare}><RefreshCcw className="h-3.5 w-3.5" /> Reset</button>
          </div>
          <div className="cp-selector-grid">
            <div>
              <label>Strategy A</label>
              <select
                value={strategyAId}
                onChange={(e) => setStrategyAId(e.target.value)}
              >
                <option value="">Select strategy A</option>
                {options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label>Strategy B</label>
              <select
                value={strategyBId}
                onChange={(e) => setStrategyBId(e.target.value)}
              >
                <option value="">Select strategy B</option>
                {options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {compareLoading ? <p className="cp-loading">Loading full strategy data for comparison...</p> : null}
        </section>

        <section className="cp-kpis">
          <article>
            <p>Selected Pairs</p>
            <strong>{strategyAId && strategyBId ? "2" : "0"}</strong>
          </article>
          <article>
            <p>Leader By Return</p>
            <strong className="up">
              {selected ? (selected.a.total >= selected.b.total ? selected.a.label : selected.b.label) : "-"}
            </strong>
          </article>
          <article>
            <p>Return Spread</p>
            <strong>
              {selected ? `${Math.abs(selected.a.total - selected.b.total).toFixed(2)}%` : "-"}
            </strong>
          </article>
          <article>
            <p>Sharpe Spread</p>
            <strong>
              {selected ? Math.abs(selected.a.sharpe - selected.b.sharpe).toFixed(2) : "-"}
            </strong>
          </article>
        </section>

        <OverlaidChart items={compareItems} />
        <CompareMetricTable items={compareItems} />
      </main>
    </div>
  )
}

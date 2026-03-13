import { useEffect, useMemo, useState } from "react"

import CompareMetricTable from "../components/compare/CompareMetricTable"
import OverlaidChart from "../components/compare/OverlaidChart"
import Card from "../components/ui/Card"
import { useStrategyStore } from "../store/useStrategyStore"

export default function ComparePage() {
  const { history, fetchHistory } = useStrategyStore()
  const [strategyA, setStrategyA] = useState(null)
  const [strategyB, setStrategyB] = useState(null)

  useEffect(() => {
    fetchHistory()
  }, [])

  const options = useMemo(
    () =>
      history.map((h) => ({
        value: h.id,
        label: `${h.ticker || "Unknown"} — ${h.strategy?.entry_rules?.[0]?.indicator || "Strategy"}`,
        data: h,
      })),
    [history],
  )

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div>
        <h2 className="text-2xl font-semibold">Compare Strategies</h2>
        <p className="text-sm text-[var(--text-secondary)]">Select two strategies to compare</p>
      </div>

      <Card className="p-3">
        <div className="grid gap-2 md:grid-cols-2">
          <select
            value={strategyA?.id || ""}
            onChange={(e) => {
              const selected = options.find((o) => o.value === e.target.value)
              setStrategyA(selected?.data || null)
            }}
            className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
          >
            <option value="">Select strategy A</option>
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <select
            value={strategyB?.id || ""}
            onChange={(e) => {
              const selected = options.find((o) => o.value === e.target.value)
              setStrategyB(selected?.data || null)
            }}
            className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2 text-sm"
          >
            <option value="">Select strategy B</option>
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </Card>

      <CompareMetricTable items={[strategyA, strategyB].filter(Boolean)} />
      <OverlaidChart items={[strategyA, strategyB].filter(Boolean)} />
    </div>
  )
}

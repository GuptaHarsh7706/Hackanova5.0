import { useMemo } from "react"

import CompareMetricTable from "../components/compare/CompareMetricTable"
import OverlaidChart from "../components/compare/OverlaidChart"
import Card from "../components/ui/Card"
import { useStrategyStore } from "../store/useStrategyStore"

export default function ComparePage() {
  const history = useStrategyStore((s) => s.history)
  const selected = useStrategyStore((s) => s.compare.selected)
  const setCompareSelection = useStrategyStore((s) => s.setCompareSelection)

  const availableIds = useMemo(() => history.map((h) => h.id), [history])

  const onToggle = (id) => {
    const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]
    if (next.length <= 3) setCompareSelection(next)
  }

  const selectedItems = history.filter((h) => selected.includes(h.id))
  const compareItems = selectedItems.map((item) => ({ ...item, results: item.results }))

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div>
        <h2 className="text-2xl font-semibold">Compare Strategies</h2>
        <p className="text-sm text-[var(--text-secondary)]">Select up to 3 strategies</p>
      </div>

      <Card className="p-3">
        <div className="grid gap-2 md:grid-cols-3">
          {availableIds.map((id) => {
            const item = history.find((h) => h.id === id)
            const active = selected.includes(id)
            return (
              <button
                key={id}
                onClick={() => onToggle(id)}
                className={`rounded-md border px-3 py-2 text-left text-xs ${active ? "border-[var(--brand-500)] bg-[var(--brand-500)]/10" : "border-[var(--border-default)]"}`}
              >
                <p className="font-semibold text-[var(--text-primary)]">{item?.name}</p>
                <p className="text-[var(--text-secondary)]">{item?.ticker}</p>
              </button>
            )
          })}
        </div>
      </Card>

      {!history.length ? (
        <div className="space-y-2">
          <div className="h-24 animate-pulse rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)]" />
          <div className="h-48 animate-pulse rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)]" />
        </div>
      ) : (
        <>
          <CompareMetricTable items={compareItems} />
          <OverlaidChart items={compareItems} />
        </>
      )}
    </div>
  )
}

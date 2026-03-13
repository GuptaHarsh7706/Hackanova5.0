import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"

import HistoryGrid from "../components/history/HistoryGrid"
import FilterDrawer from "../components/history/FilterDrawer"
import Input from "../components/ui/Input"
import { useStrategyStore } from "../store/useStrategyStore"

export default function HistoryPage() {
  const navigate = useNavigate()
  const { history, historyLoading, fetchHistory, deleteHistoryItem } = useStrategyStore()
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState("recent")
  const [openFilter, setOpenFilter] = useState(false)

  useEffect(() => {
    fetchHistory()
    console.log("%c[TriVector] HistoryPage mounted — fetching history", "color:#7f77dd;font-weight:600")
  }, [])

  // Safe label extraction — backend returns strategy.ticker, not item.name
  const getLabel = (item) =>
    item?.strategy?.ticker || item?.ticker_used || item?.ticker || item?.name || "Strategy"

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = history.filter((i) => {
      const label = getLabel(i).toLowerCase()
      return label.includes(q) || (i?.data_period || "").toLowerCase().includes(q)
    })
    if (sort === "recent") list = [...list].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    if (sort === "name")   list = [...list].sort((a, b) => getLabel(a).localeCompare(getLabel(b)))
    return list
  }, [history, query, sort])

  if (historyLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="mb-2 text-lg font-semibold">Loading history...</div>
          <div className="text-sm text-[var(--text-secondary)]">Please wait while we fetch your past backtests.</div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Strategy History</h2>
          <p className="text-sm text-[var(--text-secondary)]">{history.length} saved strategies</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input placeholder="Search..." value={query} onChange={(e) => setQuery(e.target.value)} className="w-52" />
          <button className="rounded-md border border-[var(--border-default)] px-3 py-2 text-xs" onClick={() => setOpenFilter(true)}>Filter</button>
          <select className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-2 py-2 text-xs" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="recent">Sort: Recent</option>
            <option value="name">Sort: Name</option>
          </select>
        </div>
      </div>
      <HistoryGrid
        items={filtered}
        onDelete={deleteHistoryItem}
        onOpen={(item) => navigate(`/app/results/${item.id}`)}
      />
      <FilterDrawer open={openFilter} onClose={() => setOpenFilter(false)} />
    </div>
  )
}

import { useEffect, useMemo, useState } from "react"

import { getHistory } from "../api/strategyApi"
import HistoryGrid from "../components/history/HistoryGrid"
import FilterDrawer from "../components/history/FilterDrawer"
import Input from "../components/ui/Input"
import { useStrategyStore } from "../store/useStrategyStore"

export default function HistoryPage() {
  const items = useStrategyStore((s) => s.history)
  const setHistory = useStrategyStore((s) => s.setHistory)
  const addToast = useStrategyStore((s) => s.addToast)
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState("recent")
  const [openFilter, setOpenFilter] = useState(false)

  useEffect(() => {
    let active = true
    getHistory()
      .then((remoteItems) => {
        if (active && remoteItems.length) setHistory(remoteItems)
      })
      .catch(() => {
        if (active) addToast("warning", "History service unavailable. Showing local data.")
      })
    return () => {
      active = false
    }
  }, [addToast, setHistory])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = items.filter((i) => i.name.toLowerCase().includes(q) || i.ticker.toLowerCase().includes(q))
    if (sort === "recent") list = [...list].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    if (sort === "name") list = [...list].sort((a, b) => a.name.localeCompare(b.name))
    return list
  }, [items, query, sort])

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Strategy History</h2>
          <p className="text-sm text-[var(--text-secondary)]">{items.length} saved strategies</p>
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
      <HistoryGrid items={filtered} />
      <FilterDrawer open={openFilter} onClose={() => setOpenFilter(false)} />
    </div>
  )
}

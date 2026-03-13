import { useMemo, useState } from "react"

import Button from "../ui/Button"

export default function TradeLogTable({ trades = [] }) {
  const [page, setPage] = useState(1)
  const [sortBy, setSortBy] = useState("id")
  const [dir, setDir] = useState("asc")
  const perPage = 10

  const sorted = useMemo(() => {
    const copy = [...trades]
    copy.sort((a, b) => {
      const x = a[sortBy]
      const y = b[sortBy]
      if (x === y) return 0
      return dir === "asc" ? (x > y ? 1 : -1) : x > y ? -1 : 1
    })
    return copy
  }, [trades, sortBy, dir])

  const pages = Math.max(1, Math.ceil(sorted.length / perPage))
  const rows = sorted.slice((page - 1) * perPage, page * perPage)

  const setSort = (key) => {
    if (key === sortBy) setDir((d) => (d === "asc" ? "desc" : "asc"))
    else {
      setSortBy(key)
      setDir("asc")
    }
  }

  return (
    <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-3">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Trades ({trades.length})</h3>
        <Button size="sm" variant="secondary">Export CSV</Button>
      </div>
      <div className="overflow-auto">
        <table className="w-full min-w-[680px] text-xs">
          <thead>
            <tr className="text-left text-[var(--text-secondary)]">
              {[
                ["id", "#"],
                ["date_in", "Date In"],
                ["date_out", "Date Out"],
                ["entry_price", "Entry"],
                ["exit_price", "Exit"],
                ["pnl_usd", "PnL"],
                ["return_pct", "Return"],
                ["hold_days", "Hold"],
              ].map(([key, label]) => (
                <th key={key} className="cursor-pointer py-2" onClick={() => setSort(key)}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={r.id} className={idx % 2 ? "bg-[var(--bg-elevated)]/40" : ""}>
                <td className="py-2">{r.id}</td>
                <td>{r.date_in}</td>
                <td>{r.date_out}</td>
                <td>${r.entry_price}</td>
                <td>${r.exit_price}</td>
                <td className={r.pnl_usd >= 0 ? "text-emerald-300" : "text-red-300"}>${r.pnl_usd}</td>
                <td className={r.return_pct >= 0 ? "text-emerald-300" : "text-red-300"}>{r.return_pct}%</td>
                <td>{r.hold_days}d</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</Button>
        <span className="text-xs text-[var(--text-secondary)]">{page}/{pages}</span>
        <Button size="sm" variant="ghost" onClick={() => setPage((p) => Math.min(pages, p + 1))}>Next</Button>
      </div>
    </div>
  )
}

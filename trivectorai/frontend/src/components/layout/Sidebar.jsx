import { GitCompare, History, MessageSquare, Plus, Settings, TrendingUp, X } from "lucide-react"
import { NavLink, useNavigate } from "react-router-dom"

import { useStrategyStore } from "../../store/useStrategyStore"
import Button from "../ui/Button"

const nav = [
  { to: "/app",          label: "Chat",     icon: MessageSquare, end: true },
  { to: "/app/history",  label: "History",  icon: History },
  { to: "/app/compare",  label: "Compare",  icon: GitCompare },
  { to: "/app/settings", label: "Settings", icon: Settings },
]

export default function Sidebar() {
  const history     = useStrategyStore((s) => s.history)
  const resetChat   = useStrategyStore((s) => s.resetChat)
  const navigate    = useNavigate()

  return (
    <aside className="hidden border-r border-[var(--border-default)] bg-[var(--bg-surface)] md:flex md:w-[60px] lg:w-[220px] lg:flex-col">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2.5 border-b border-[var(--border-default)] px-3">
        <div className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg bg-[var(--brand-600)] shadow-[var(--shadow-brand)]">
          <TrendingUp className="h-4 w-4 text-white" />
        </div>
        <div className="hidden leading-tight lg:block">
          <p className="text-sm font-bold tracking-tight">TriVector<span className="text-[var(--brand-400)]">AI</span></p>
          <p className="text-[10px] text-[var(--text-muted)]">Algo Strategy Builder</p>
        </div>
      </div>

      {/* New strategy */}
      <div className="px-2 py-3 lg:px-3">
        <Button variant="primary" size="sm" className="w-full gap-1.5" onClick={resetChat}>
          <Plus className="h-4 w-4" />
          <span className="hidden lg:inline">New Strategy</span>
        </Button>
      </div>

      {/* Nav */}
      <nav className="space-y-0.5 px-2">
        <p className="micro mb-1 hidden px-2 text-[var(--text-muted)] lg:block">Navigation</p>
        {nav.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-ui ${
                  isActive
                    ? "bg-[var(--brand-900)] text-[var(--brand-300)] font-medium"
                    : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
                }`
              }
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              <span className="hidden lg:inline">{item.label}</span>
            </NavLink>
          )
        })}
      </nav>

      {/* Recent strategies */}
      {history.length > 0 && (
        <div className="mt-4 hidden flex-1 px-3 lg:block">
          <p className="micro mb-2 text-[var(--text-muted)]">Recent</p>
          <div className="space-y-0.5">
            {history.slice(0, 4).map((item) => {
              const label = item.strategy?.ticker || item.ticker_used || item.name || "Strategy"
              return (
                <button
                  key={item.id}
                  className="group flex w-full items-center justify-between rounded-md px-2 py-1.5 hover:bg-[var(--bg-elevated)] text-left"
                  onClick={() => navigate(`/app/results/${item.id}`)}
                >
                  <span className="truncate text-xs text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]">
                    {label}
                  </span>
                  <span className="ml-2 flex-shrink-0 text-[10px] text-[var(--text-muted)]">
                    {item.metrics?.total_return_pct != null
                      ? `${item.metrics.total_return_pct > 0 ? "+" : ""}${Number(item.metrics.total_return_pct).toFixed(1)}%`
                      : ""}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-auto border-t border-[var(--border-default)] px-3 py-3">
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-full bg-[var(--brand-900)] text-[10px] font-bold text-[var(--brand-300)]">TV</div>
          <p className="hidden text-xs text-[var(--text-muted)] lg:block">v0.3.0 · Phase 3</p>
        </div>
      </div>
    </aside>
  )
}

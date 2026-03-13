import { GitCompare, History, MessageSquare, Plus, Settings, X } from "lucide-react"
import { NavLink } from "react-router-dom"

import { useStrategyStore } from "../../store/useStrategyStore"
import Button from "../ui/Button"
import Tooltip from "../ui/Tooltip"

const nav = [
  { to: "/app", label: "Chat", icon: MessageSquare },
  { to: "/app/history", label: "History", icon: History },
  { to: "/app/compare", label: "Compare", icon: GitCompare },
  { to: "/app/settings", label: "Settings", icon: Settings },
]

export default function Sidebar() {
  const history = useStrategyStore((s) => s.history)
  const resetChat = useStrategyStore((s) => s.resetChat)
  const compact = false

  return (
    <aside className="hidden border-r border-[var(--border-default)] bg-[var(--bg-surface)] md:flex md:w-[60px] lg:w-[220px] lg:flex-col">
      <div className="flex h-14 items-center gap-2 border-b border-[var(--border-default)] px-3">
        <div className="grid h-8 w-8 place-items-center rounded-md bg-[var(--brand-600)] font-semibold text-white">T</div>
        <div className="hidden leading-tight lg:block">
          <p className="text-sm font-semibold">TriVector</p>
          <p className="text-xs text-[var(--text-secondary)]">AI</p>
        </div>
      </div>

      <div className="px-2 py-3 lg:px-3">
        <Button variant="primary" size="sm" className="w-full" onClick={resetChat}>
          <Plus className="h-4 w-4" />
          <span className="hidden lg:inline">New Strategy</span>
        </Button>
      </div>

      <div className="space-y-1 px-2">
        <p className="micro hidden px-2 text-[var(--text-muted)] lg:block">Navigation</p>
        {nav.map((item) => {
          const Icon = item.icon
          const link = (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-md px-2 py-2 text-sm transition-ui ${
                  isActive
                    ? "bg-[var(--brand-900)] text-[var(--brand-400)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
                }`
              }
            >
              <Icon className="h-4 w-4" />
              <span className="hidden lg:inline">{item.label}</span>
            </NavLink>
          )
          return compact ? (
            <Tooltip key={item.to} text={item.label}>
              {link}
            </Tooltip>
          ) : (
            link
          )
        })}
      </div>

      <div className="mt-3 hidden flex-1 px-3 lg:block">
        <p className="micro mb-2 text-[var(--text-muted)]">Recent</p>
        <div className="space-y-1">
          {history.slice(0, 3).map((item) => (
            <div key={item.id} className="group flex items-center justify-between rounded-md px-2 py-1 hover:bg-[var(--bg-elevated)]">
              <span className="truncate text-xs text-[var(--text-secondary)]">{item.name}</span>
              <button className="hidden text-[var(--text-muted)] group-hover:block">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-auto border-t border-[var(--border-default)] px-3 py-3">
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-full bg-[var(--brand-900)] text-[10px]">P1</div>
          <p className="hidden text-xs text-[var(--text-secondary)] lg:block">Phase 1 - v0.1.0</p>
        </div>
      </div>
    </aside>
  )
}

import { useState } from "react"

import clsx from "clsx"
import { Clock3, Menu, Settings2, Sparkles } from "lucide-react"

import Button from "../ui/Button"

export default function Sidebar({ onNewStrategy }) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={clsx(
        "hidden h-full flex-col border-r border-surface-border bg-[#12121a] md:flex",
        collapsed ? "w-[76px]" : "w-[220px]",
      )}
    >
      <div className="flex items-center justify-between border-b border-surface-border px-4 py-4">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-xs font-bold text-white">TV</div>
          <div className={clsx("min-w-0", collapsed && "hidden")}>
            <p className="text-sm font-semibold text-gray-100">TriVectorAI</p>
            <p className="text-xs text-gray-400">Strategy Agent</p>
          </div>
        </div>
        <button type="button" onClick={() => setCollapsed((v) => !v)}>
          <Menu className="h-4 w-4 text-gray-500" />
        </button>
      </div>

      <nav className="flex-1 space-y-2 p-3">
        <Button variant="primary" className={clsx("w-full", collapsed ? "justify-center" : "justify-start")} onClick={onNewStrategy}>
          <Sparkles className="mr-2 h-4 w-4" />
          {!collapsed && "New Strategy"}
        </Button>
        <button
          disabled
          className={clsx(
            "w-full rounded-xl border border-surface-border px-4 py-2 text-left text-sm text-gray-500",
            "cursor-not-allowed opacity-70",
          )}
        >
          <Clock3 className="mr-2 inline h-4 w-4" />
          {!collapsed && "History (Phase 2)"}
        </button>
        <button
          disabled
          className={clsx(
            "w-full rounded-xl border border-surface-border px-4 py-2 text-left text-sm text-gray-500",
            "cursor-not-allowed opacity-70",
          )}
        >
          <Settings2 className="mr-2 inline h-4 w-4" />
          {!collapsed && "Settings (Phase 2)"}
        </button>
      </nav>

      <div className={clsx("border-t border-surface-border p-3", collapsed && "px-2")}>
        <div className="rounded-xl border border-brand-900/60 bg-brand-900/20 px-3 py-2 text-center text-xs text-brand-100">
          {collapsed ? "P1" : "Phase 1 - Parser"}
        </div>
      </div>
    </aside>
  )
}

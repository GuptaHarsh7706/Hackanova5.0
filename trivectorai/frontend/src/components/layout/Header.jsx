import { BookOpen, Menu } from "lucide-react"
import { useLocation } from "react-router-dom"

import { useStrategyStore } from "../../store/useStrategyStore"

const titleByPath = {
  "/app": "Strategy Parser",
  "/app/history": "History",
  "/app/compare": "Compare",
  "/app/settings": "Settings",
}

export default function Header() {
  const location = useLocation()
  const setMobileStrategySheetOpen = useStrategyStore((s) => s.setMobileStrategySheetOpen)
  const path = location.pathname
  const title = path.startsWith("/app/results") ? "Results" : titleByPath[path] || "Strategy Parser"
  const showMobilePanelControl = path === "/app"

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[var(--border-default)] bg-[var(--bg-base)] px-4">
      <div className="flex items-center gap-2">
        {showMobilePanelControl ? (
          <button
            className="rounded-md p-1 text-[var(--text-secondary)] md:hidden"
            onClick={() => setMobileStrategySheetOpen(true)}
            title="Open strategy panel"
          >
            <Menu className="h-4 w-4" />
          </button>
        ) : null}
        <h1 className="text-base font-semibold">{title}</h1>
      </div>

      <div className="flex items-center gap-3">
        <button className="rounded-md p-1 text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]">
          <BookOpen className="h-4 w-4" />
        </button>
        <button className="rounded-full border border-[var(--border-default)] px-2 py-1 text-xs text-[var(--text-muted)]" disabled>
          Dark
        </button>
        <div className="grid h-8 w-8 place-items-center rounded-full bg-[var(--brand-700)] text-xs font-semibold">TV</div>
      </div>
    </header>
  )
}

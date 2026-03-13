import { BookOpen, Menu, Wifi, WifiOff, Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useLocation } from "react-router-dom"

import { useStrategyStore } from "../../store/useStrategyStore"

const titleByPath = {
  "/app": "Strategy Parser",
  "/app/history": "History",
  "/app/compare": "Compare",
  "/app/settings": "Settings",
}

function BackendStatus() {
  const status  = useStrategyStore((s) => s.backendStatus)
  const version = useStrategyStore((s) => s.backendVersion)
  const check   = useStrategyStore((s) => s.checkBackendHealth)

  useEffect(() => {
    check()
    const id = setInterval(check, 30_000)
    return () => clearInterval(id)
  }, [])

  if (status === "unknown") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-default)] px-2 py-1 text-xs text-[var(--text-muted)]">
        <Loader2 className="h-3 w-3 animate-spin" /> Connecting…
      </span>
    )
  }
  if (status === "offline") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-red-800 bg-red-950/50 px-2 py-1 text-xs text-red-400">
        <WifiOff className="h-3 w-3" /> Backend offline
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-800 bg-emerald-950/50 px-2 py-1 text-xs text-emerald-400">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
        <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400" />
      </span>
      {status === "degraded" ? "DB degraded" : `Online${version ? ` v${version}` : ""}`}
    </span>
  )
}

export default function Header() {
  const location = useLocation()
  const setMobileStrategySheetOpen = useStrategyStore((s) => s.setMobileStrategySheetOpen)
  const path  = location.pathname
  const title = path.startsWith("/app/results") ? "Results" : titleByPath[path] || "Strategy Parser"
  const showMobilePanelControl = path === "/app"

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[var(--border-default)] bg-[var(--bg-base)]/90 px-4 backdrop-blur-sm">
      <div className="flex items-center gap-2">
        {showMobilePanelControl ? (
          <button
            className="rounded-md p-1 text-[var(--text-secondary)] md:hidden"
            onClick={() => setMobileStrategySheetOpen?.(true)}
            title="Open strategy panel"
          >
            <Menu className="h-4 w-4" />
          </button>
        ) : null}
        <h1 className="text-base font-semibold">{title}</h1>
      </div>

      <div className="flex items-center gap-3">
        <BackendStatus />
        <a
          href="http://localhost:8000/docs"
          target="_blank"
          rel="noreferrer"
          className="rounded-md p-1 text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
          title="API docs"
        >
          <BookOpen className="h-4 w-4" />
        </a>
        <div className="grid h-8 w-8 place-items-center rounded-full bg-[var(--brand-700)] text-xs font-semibold">TV</div>
      </div>
    </header>
  )
}

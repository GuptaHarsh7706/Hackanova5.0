import { Outlet, useLocation } from "react-router-dom"

import { useStrategyStore } from "../../store/useStrategyStore"
import Toast from "../ui/Toast"
import BottomTabBar from "./BottomTabBar"
import Header from "./Header"
import Sidebar from "./Sidebar"

export default function MainLayout() {
  const location = useLocation()
  const toasts = useStrategyStore((s) => s.toasts)
  const dismissToast = useStrategyStore((s) => s.dismissToast)
  const noShellPaths = new Set(["/app", "/app/strategy-lab", "/app/dashboard", "/app/backtests"])
  const isDashboardHome =
    noShellPaths.has(location.pathname) ||
    location.pathname.startsWith("/app/results/") ||
    location.pathname.startsWith("/app/trade-analytics") ||
    location.pathname.startsWith("/app/sandbox") ||
    location.pathname.startsWith("/app/live-signals") ||
    location.pathname.startsWith("/app/market-data") ||
    location.pathname === "/app/compare"

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)]">
      {isDashboardHome ? (
        <div className="min-h-screen">
          <Outlet />
        </div>
      ) : (
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex min-h-screen min-w-0 flex-1 flex-col">
            <Header />
            <div className="flex-1 pb-16 md:pb-0">
              <Outlet />
            </div>
          </div>
        </div>
      )}
      {!isDashboardHome ? <BottomTabBar /> : null}
      <Toast toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}

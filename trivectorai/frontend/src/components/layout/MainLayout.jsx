import { Outlet } from "react-router-dom"

import { useStrategyStore } from "../../store/useStrategyStore"
import Toast from "../ui/Toast"
import BottomTabBar from "./BottomTabBar"
import Header from "./Header"
import Sidebar from "./Sidebar"

export default function MainLayout() {
  const toasts = useStrategyStore((s) => s.toasts)
  const dismissToast = useStrategyStore((s) => s.dismissToast)

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)]">
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <Header />
          <div className="flex-1 pb-16 md:pb-0">
            <Outlet />
          </div>
        </div>
      </div>
      <BottomTabBar />
      <Toast toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}

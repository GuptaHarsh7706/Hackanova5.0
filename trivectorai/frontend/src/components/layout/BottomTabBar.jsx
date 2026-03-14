import { MessageSquare, History, GitCompare, Settings, BarChart3 } from "lucide-react"
import { NavLink } from "react-router-dom"

const tabs = [
  { to: "/app", label: "Chat", icon: MessageSquare },
  { to: "/app/trade-analytics", label: "Analytics", icon: BarChart3 },
  { to: "/app/history", label: "History", icon: History },
  { to: "/app/compare", label: "Compare", icon: GitCompare },
  { to: "/app/settings", label: "Settings", icon: Settings },
]

export default function BottomTabBar() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 h-14 border-t border-[var(--border-default)] bg-[var(--bg-surface)] px-2 md:hidden">
      <ul className="grid h-full grid-cols-5">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <li key={tab.to} className="grid place-items-center">
              <NavLink
                to={tab.to}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-1 text-[11px] ${isActive ? "text-[var(--brand-400)]" : "text-[var(--text-muted)]"}`
                }
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </NavLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

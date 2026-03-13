import { PanelRight, Sparkles } from "lucide-react"

import Button from "../ui/Button"

export default function Header({ onOpenMobilePanel }) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-surface-border px-4 md:px-6">
      <div className="flex items-center gap-2 text-gray-200">
        <Sparkles className="h-4 w-4 text-brand-400" />
        <span className="text-sm font-semibold uppercase tracking-[0.24em]">Agentic Strategy Parser</span>
      </div>
      <Button variant="ghost" className="md:hidden" onClick={onOpenMobilePanel}>
        <PanelRight className="h-4 w-4" />
      </Button>
    </header>
  )
}

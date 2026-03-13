import { Sparkles } from "lucide-react"

import Button from "../ui/Button"

export default function AIInsightPanel({ narrative }) {
  return (
    <div className="rounded-xl border border-[var(--border-default)] border-l-[var(--brand-500)] bg-[var(--bg-surface)] p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-[var(--brand-400)]" />AI Analysis</h3>
        <Button variant="ghost" size="sm">Regenerate</Button>
      </div>
      <p className="text-sm leading-7 text-[var(--text-secondary)]">
        {narrative || "AI analysis will appear here after the backtest finishes."}
      </p>
      <div className="mt-3">
        <Button size="sm">Try suggested improvement</Button>
      </div>
    </div>
  )
}

import { useState } from "react"
import { ChevronDown, ChevronUp, Code2 } from "lucide-react"

import RuleCard from "./RuleCard"
import MissingFieldAlert from "./MissingFieldAlert"
import Tooltip from "../ui/Tooltip"

export default function StrategyPanel({ strategy, missingFields }) {
  const [showRaw, setShowRaw] = useState(false)

  if (!strategy) {
    return (
      <aside className="h-full w-full border-t border-surface-border p-4 md:w-[380px] md:border-l md:border-t-0">
        <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-surface-border p-6 text-center text-sm text-gray-500">
          Your parsed strategy will appear here
        </div>
      </aside>
    )
  }

  return (
    <aside className="h-full w-full border-t border-surface-border p-4 md:w-[380px] md:border-l md:border-t-0">
      <div className="h-full overflow-y-auto rounded-2xl border border-surface-border bg-[#13131a] p-4 animate-slide-up">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white">
              {strategy.ticker || "UNKNOWN"}
            </span>
            <span className="rounded-full border border-surface-border px-2.5 py-1 text-xs text-gray-200">{strategy.timeframe}</span>
          </div>
          <span className="text-xs text-gray-400">{Math.round((strategy.confidence_score || 0) * 100)}%</span>
        </div>

        <div className="mt-2 h-2 rounded-full bg-surface">
          <div
            className="h-2 rounded-full bg-brand-400 transition-all"
            style={{ width: `${Math.max(5, Math.round((strategy.confidence_score || 0) * 100))}%` }}
          />
        </div>

        <section className="mt-4 space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Entry Rules</h3>
          {strategy.entry_rules?.length ? (
            strategy.entry_rules.map((rule, idx) => <RuleCard key={`entry-${idx}`} rule={rule} />)
          ) : (
            <p className="text-xs text-gray-500">No entry rules parsed yet.</p>
          )}
        </section>

        <section className="mt-4 space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Exit Rules</h3>
          {strategy.exit_rules?.length ? (
            strategy.exit_rules.map((rule, idx) => <RuleCard key={`exit-${idx}`} rule={rule} />)
          ) : (
            <p className="text-xs text-gray-500">No exit rules specified.</p>
          )}
        </section>

        <section className="mt-4 rounded-xl border border-surface-border p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Risk</h3>
          <div className="mt-2 space-y-1 text-xs text-gray-200">
            <p>Position size: {strategy.position_size}</p>
            <p>Stop loss: {strategy.stop_loss_pct ?? "-"}%</p>
            <p>Take profit: {strategy.take_profit_pct ?? "-"}%</p>
          </div>
        </section>

        <div className="mt-4">
          <MissingFieldAlert fields={missingFields} />
        </div>

        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowRaw((s) => !s)}
            className="inline-flex items-center gap-1 text-xs text-gray-300 hover:text-white"
          >
            <Code2 className="h-3.5 w-3.5" />
            JSON raw view
            {showRaw ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>

          <Tooltip text="Coming in Phase 2">
            <button
              disabled
              className="cursor-not-allowed rounded-xl bg-gray-600 px-3 py-2 text-xs font-semibold text-gray-300"
            >
              Run Backtest
            </button>
          </Tooltip>
        </div>

        {showRaw && (
          <pre className="mt-3 overflow-x-auto rounded-xl border border-surface-border bg-surface p-3 text-xs text-gray-200">
            {JSON.stringify(strategy, null, 2)}
          </pre>
        )}
      </div>
    </aside>
  )
}

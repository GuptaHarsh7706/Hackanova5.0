import Button from "../ui/Button"
import Card from "../ui/Card"

export default function ConfirmationCard({ strategy, onRunBacktest, parseDetails = {}, canRun = false, agentTrace = [] }) {
  if (!strategy) return null

  const readiness = Number(parseDetails.readiness_score ?? 0)
  const entrySignals = parseDetails.extracted_signals || []
  const assumptions = parseDetails.assumptions || []
  const issues = parseDetails.issues || []
  const assignments = parseDetails.agent_assignments || []
  const researchNotes = parseDetails.context_profile?.research_notes || []

  return (
    <Card className="mt-2 p-3" active>
      <div className="mb-2 flex items-center justify-between text-sm">
        <p className="font-semibold text-emerald-300">Strategy Parsed</p>
        <span className="text-xs text-[var(--text-secondary)]">{Math.round((strategy.confidence_score || 1) * 100)}% conf</span>
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px]">
        <span className={`rounded-sm border px-1.5 py-0.5 font-mono ${canRun ? "border-emerald-700 text-emerald-300" : "border-amber-700 text-amber-300"}`}>
          {canRun ? "READY" : "NEEDS INPUT"}
        </span>
        <span className="rounded-sm border border-[var(--border-default)] px-1.5 py-0.5 font-mono text-[var(--text-secondary)]">
          READINESS {Number.isFinite(readiness) ? readiness : 0}
        </span>
      </div>

      <p className="mb-2 text-xs text-[var(--text-secondary)]">
        {strategy.ticker || "-"} - {strategy.timeframe || "-"} - {strategy.asset_class || "-"}
      </p>
      <div className="space-y-1 text-xs">
        <p>
          <span className="text-[var(--text-muted)]">Entry: </span>
          {strategy.entry_rules?.[0]?.indicator} {strategy.entry_rules?.[0]?.condition}
        </p>
        <p>
          <span className="text-[var(--text-muted)]">Exit: </span>
          {strategy.exit_rules?.[0]?.indicator || "Not specified"}
        </p>
      </div>

      {parseDetails.reasoning_summary ? (
        <p className="mt-2 text-xs text-[var(--text-secondary)]">{parseDetails.reasoning_summary}</p>
      ) : null}

      {entrySignals.length > 0 ? (
        <div className="mt-3 rounded-sm border border-[var(--border-default)] bg-black/20 p-2">
          <p className="mb-1 font-mono text-[10px] text-[var(--brand-300)]">EXTRACTED SIGNALS</p>
          <ul className="space-y-1 text-xs text-[var(--text-secondary)]">
            {entrySignals.map((signal, idx) => (
              <li key={`${signal}-${idx}`}>- {signal}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {assumptions.length > 0 ? (
        <div className="mt-2 rounded-sm border border-[var(--border-default)] bg-black/20 p-2">
          <p className="mb-1 font-mono text-[10px] text-[var(--text-muted)]">ASSUMPTIONS</p>
          <ul className="space-y-1 text-xs text-[var(--text-secondary)]">
            {assumptions.map((line, idx) => (
              <li key={`${line}-${idx}`}>- {line}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {researchNotes.length > 0 ? (
        <div className="mt-2 rounded-sm border border-[var(--border-default)] bg-black/20 p-2">
          <p className="mb-1 font-mono text-[10px] text-[var(--text-muted)]">RESEARCH NOTES</p>
          <ul className="space-y-1 text-xs text-[var(--text-secondary)]">
            {researchNotes.slice(0, 2).map((line, idx) => (
              <li key={`${line}-${idx}`}>- {line}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {assignments.length > 0 ? (
        <div className="mt-2 rounded-sm border border-[var(--border-default)] bg-black/20 p-2">
          <p className="mb-1 font-mono text-[10px] text-[var(--text-muted)]">AGENT HANDOFFS</p>
          <div className="space-y-1 text-xs text-[var(--text-secondary)]">
            {assignments.map((item, idx) => (
              <p key={`${item.agent}-${idx}`}>
                <span className="font-mono text-[var(--brand-200)]">{item.agent}</span>: {item.output}
              </p>
            ))}
          </div>
        </div>
      ) : null}

      {parseDetails.dsl_preview ? (
        <div className="mt-2 rounded-sm border border-[var(--border-default)] bg-black/20 p-2">
          <p className="mb-1 font-mono text-[10px] text-[var(--text-muted)]">DSL PREVIEW</p>
          <pre className="max-h-36 overflow-auto whitespace-pre-wrap font-mono text-[10px] text-[var(--text-secondary)]">{parseDetails.dsl_preview}</pre>
        </div>
      ) : null}

      {issues.length > 0 ? (
        <div className="mt-2 rounded-sm border border-red-900/70 bg-red-950/20 p-2">
          <p className="mb-1 font-mono text-[10px] text-red-300">ISSUES TO FIX</p>
          <ul className="space-y-1 text-xs text-red-200">
            {issues.slice(0, 4).map((issue, idx) => (
              <li key={`${issue}-${idx}`}>- {issue}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {agentTrace.length > 0 ? (
        <div className="mt-2 rounded-sm border border-[var(--border-default)] bg-black/20 p-2">
          <p className="mb-1 font-mono text-[10px] text-[var(--text-muted)]">AGENT TRACE</p>
          <p className="text-[11px] text-[var(--text-secondary)]">{agentTrace.join(" -> ")}</p>
        </div>
      ) : null}

      <div className="mt-3 flex gap-2">
        <Button size="sm" onClick={onRunBacktest} disabled={!canRun}>
          Run Backtest
        </Button>
        <Button size="sm" variant="ghost">
          Edit Strategy
        </Button>
      </div>
    </Card>
  )
}

import Card from "../ui/Card"

export default function ClarificationCard({ missingFields = [], parseDetails = {}, agentTrace = [] }) {
  const issues = parseDetails.issues || []
  const assumptions = parseDetails.assumptions || []
  const readiness = Number(parseDetails.readiness_score ?? 0)
  const assignments = parseDetails.agent_assignments || []
  const researchNotes = parseDetails.context_profile?.research_notes || []

  return (
    <Card className="mt-2 border-amber-700/60 p-3">
      <p className="mb-2 text-sm font-semibold text-amber-300">Need a bit more info</p>
      <p className="mb-2 text-[11px] text-[var(--text-secondary)]">
        Readiness score: <span className="font-mono text-amber-200">{Number.isFinite(readiness) ? readiness : 0}</span>
      </p>

      {parseDetails.reasoning_summary ? (
        <p className="mb-2 text-xs text-[var(--text-secondary)]">{parseDetails.reasoning_summary}</p>
      ) : null}

      <ul className="list-disc space-y-1 pl-4 text-xs text-[var(--text-secondary)]">
        {missingFields.includes("ticker") ? <li>Which asset? (AAPL, BTCUSDT, EURUSD)</li> : null}
        {missingFields.includes("timeframe") ? <li>What timeframe? (daily, hourly, etc.)</li> : null}
        {missingFields.includes("entry_rules") ? <li>What exact entry condition should trigger a buy/entry?</li> : null}
      </ul>

      {issues.length > 0 ? (
        <div className="mt-2 rounded-sm border border-red-900/70 bg-red-950/20 p-2">
          <p className="mb-1 font-mono text-[10px] text-red-300">ISSUES FOUND</p>
          <ul className="space-y-1 text-xs text-red-200">
            {issues.slice(0, 4).map((issue, idx) => (
              <li key={`${issue}-${idx}`}>- {issue}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {assumptions.length > 0 ? (
        <div className="mt-2 rounded-sm border border-[var(--border-default)] bg-black/20 p-2">
          <p className="mb-1 font-mono text-[10px] text-[var(--text-muted)]">CURRENT ASSUMPTIONS</p>
          <ul className="space-y-1 text-xs text-[var(--text-secondary)]">
            {assumptions.map((line, idx) => (
              <li key={`${line}-${idx}`}>- {line}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {researchNotes.length > 0 ? (
        <div className="mt-2 rounded-sm border border-[var(--border-default)] bg-black/20 p-2">
          <p className="mb-1 font-mono text-[10px] text-[var(--text-muted)]">RESEARCH CONTEXT</p>
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

      {agentTrace.length > 0 ? (
        <p className="mt-2 text-[11px] text-[var(--text-muted)]">
          Agent trace: {agentTrace.join(" -> ")}
        </p>
      ) : null}
    </Card>
  )
}

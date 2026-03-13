import StrategyBadge from "./StrategyBadge"

export default function RuleCard({ rule }) {
  return (
    <div>
      {rule.logic_operator && rule.logic_operator !== "NONE" && (
        <p className="mb-2 text-center text-[11px] font-bold tracking-wide text-brand-100">{rule.logic_operator}</p>
      )}
      <div className="rounded-xl border border-surface-border bg-surface-card/80 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <StrategyBadge label={rule.indicator} indicator={rule.indicator} />
          {rule.params?.period && (
            <span className="rounded-full border border-surface-border px-2.5 py-1 text-xs text-gray-300">
              period {rule.params.period}
            </span>
          )}
          <span className="rounded-full border border-brand-600/30 bg-brand-600/20 px-2.5 py-1 text-xs text-brand-100">
            {rule.condition.replaceAll("_", " ")}
          </span>
          {rule.value !== null && rule.value !== undefined && (
            <span className="rounded-full border border-surface-border bg-surface px-2.5 py-1 text-xs font-mono text-gray-100">
              {String(rule.value)}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

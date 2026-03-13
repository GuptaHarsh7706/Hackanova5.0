import StrategyBadge from "./StrategyBadge"

export default function RuleCard({ rule }) {
  if (!rule) return null

  return (
    <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] p-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <StrategyBadge indicator={rule.indicator} />
        <span className="text-[var(--text-secondary)]">{String(rule.condition || "").replaceAll("_", " ")}</span>
        {typeof rule.value === "string" && rule.value.includes("_") ? (
          <StrategyBadge indicator={rule.value.split("_")[0]} />
        ) : (
          <span className="font-semibold">{String(rule.value)}</span>
        )}
      </div>
    </div>
  )
}

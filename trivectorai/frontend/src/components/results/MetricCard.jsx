import Card from "../ui/Card"

export default function MetricCard({ label, value, sub, tone = "neutral" }) {
  const color = tone === "good" ? "text-emerald-300" : tone === "bad" ? "text-red-300" : "text-[var(--text-primary)]"
  return (
    <Card hoverable className="min-w-[180px] p-3">
      <p className="micro text-[var(--text-muted)]">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${color}`}>{value}</p>
      <p className="mt-1 text-xs text-[var(--text-secondary)]">{sub}</p>
    </Card>
  )
}

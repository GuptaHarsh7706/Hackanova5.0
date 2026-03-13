const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

function tone(v) {
  if (v > 8) return "bg-emerald-500"
  if (v > 0) return "bg-emerald-700"
  if (v < -8) return "bg-red-500"
  if (v < 0) return "bg-red-700"
  return "bg-[var(--bg-elevated)]"
}

export default function MonthlyHeatmap({ data }) {
  return (
    <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-3">
      <h3 className="mb-2 text-sm font-semibold">Monthly Returns</h3>
      <div className="grid gap-1 text-[10px] text-[var(--text-secondary)]" style={{ gridTemplateColumns: "48px repeat(12, minmax(0, 1fr))" }}>
        <div />
        {months.map((m) => (
          <div key={m} className="text-center">{m}</div>
        ))}
        {Object.entries(data).map(([year, vals]) => (
          <div key={year} className="contents">
            <div key={`${year}-label`} className="pt-1 text-[11px]">{year}</div>
            {vals.map((v, idx) => (
              <div key={`${year}-${idx}`} title={`${months[idx]} ${year}: ${v}%`} className={`h-5 rounded ${tone(v)}`} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

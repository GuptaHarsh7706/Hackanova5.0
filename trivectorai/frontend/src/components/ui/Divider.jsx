export default function Divider({ label }) {
  return (
    <div className="relative my-3 border-t border-[var(--border-default)]">
      {label ? (
        <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 bg-[var(--bg-surface)] px-2 text-[11px] uppercase tracking-[0.06em] text-[var(--text-muted)]">
          {label}
        </span>
      ) : null}
    </div>
  )
}

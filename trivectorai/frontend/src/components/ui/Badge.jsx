import clsx from "clsx"

const variantClasses = {
  default: "bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-default)]",
  brand: "bg-[var(--brand-900)] text-[var(--brand-200)] border-[var(--brand-700)]",
  success: "bg-emerald-950/50 text-emerald-300 border-emerald-800",
  warning: "bg-amber-950/50 text-amber-300 border-amber-800",
  danger: "bg-red-950/50 text-red-300 border-red-800",
  info: "bg-blue-950/50 text-blue-300 border-blue-800",
}

const sizeClasses = {
  sm: "px-2 py-0.5 text-[11px]",
  md: "px-2.5 py-1 text-xs",
}

export default function Badge({ variant = "default", size = "md", dot = false, children, className }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full border font-medium uppercase tracking-[0.06em]",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
    >
      {dot ? <span className="h-1.5 w-1.5 animate-typing-dot rounded-full bg-current" /> : null}
      {children}
    </span>
  )
}

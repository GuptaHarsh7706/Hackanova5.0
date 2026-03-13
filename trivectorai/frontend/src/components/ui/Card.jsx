import clsx from "clsx"

export default function Card({ hoverable = false, active = false, className, children }) {
  return (
    <div
      className={clsx(
        "rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)]",
        hoverable && "transition-ui card-lift hover:border-[var(--border-strong)]",
        active && "border-[var(--brand-500)] shadow-[var(--shadow-brand)]",
        className,
      )}
    >
      {children}
    </div>
  )
}

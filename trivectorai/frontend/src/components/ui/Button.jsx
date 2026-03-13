import clsx from "clsx"

export default function Button({ children, className, variant = "primary", ...props }) {
  const variants = {
    primary: "bg-brand-600 hover:bg-brand-400 text-white",
    ghost: "bg-transparent border border-surface-border text-gray-200 hover:bg-surface-card",
    muted: "bg-surface-card border border-surface-border text-gray-300",
    danger: "bg-red-600 hover:bg-red-500 text-white",
  }

  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

import clsx from "clsx"

import Spinner from "./Spinner"

const variantClasses = {
  primary:
    "bg-gradient-to-r from-[var(--brand-600)] to-[var(--brand-400)] text-white hover:brightness-110 shadow-[var(--shadow-brand)]",
  secondary:
    "border border-[var(--border-default)] bg-transparent text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]",
  ghost: "bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]",
  danger: "bg-[var(--danger)]/90 text-white hover:bg-[var(--danger)]",
}

const sizeClasses = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-5 text-base",
}

export default function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  className,
  children,
  ...props
}) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-ui active:scale-[0.97] disabled:opacity-40",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Spinner size="sm" /> : children}
    </button>
  )
}

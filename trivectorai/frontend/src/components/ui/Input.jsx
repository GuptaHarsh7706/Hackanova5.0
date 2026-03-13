import clsx from "clsx"

export default function Input({ label, helper, error, className, ...props }) {
  return (
    <label className="block space-y-1.5">
      {label ? <span className="text-xs text-[var(--text-secondary)]">{label}</span> : null}
      <input
        {...props}
        className={clsx(
          "w-full rounded-md border bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition-ui",
          error
            ? "border-[var(--danger)]"
            : "border-[var(--border-default)] focus:border-[var(--brand-500)] focus:shadow-[0_0_0_2px_rgba(108,99,212,0.28)]",
          className,
        )}
      />
      {helper ? <span className={clsx("text-xs", error ? "text-[var(--danger)]" : "text-[var(--text-secondary)]")}>{helper}</span> : null}
    </label>
  )
}

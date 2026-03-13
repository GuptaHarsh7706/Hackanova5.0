import clsx from "clsx"

const positionClasses = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
  left: "right-full top-1/2 -translate-y-1/2 mr-2",
  right: "left-full top-1/2 -translate-y-1/2 ml-2",
}

export default function Tooltip({ text, children, position = "top" }) {
  return (
    <div className="group relative inline-flex">
      {children}
      <div
        className={clsx(
          "pointer-events-none absolute z-30 whitespace-nowrap rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] px-2 py-1 text-xs text-[var(--text-primary)] opacity-0 transition-opacity duration-150 delay-300 group-hover:opacity-100",
          positionClasses[position],
        )}
      >
        {text}
      </div>
    </div>
  )
}

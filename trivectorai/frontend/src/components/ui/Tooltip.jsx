export default function Tooltip({ text, children }) {
  return (
    <div className="group relative inline-flex">
      {children}
      <div className="pointer-events-none absolute -top-10 left-1/2 z-30 hidden -translate-x-1/2 rounded-md border border-surface-border bg-surface px-2 py-1 text-xs text-gray-200 group-hover:block">
        {text}
      </div>
    </div>
  )
}

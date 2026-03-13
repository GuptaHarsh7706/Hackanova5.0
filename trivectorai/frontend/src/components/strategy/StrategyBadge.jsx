import clsx from "clsx"

const COLOR_MAP = {
  SMA: "bg-sky-500/20 text-sky-200 border-sky-500/40",
  EMA: "bg-blue-500/20 text-blue-200 border-blue-500/40",
  RSI: "bg-orange-500/20 text-orange-200 border-orange-500/40",
  MACD: "bg-violet-500/20 text-violet-200 border-violet-500/40",
  BBANDS: "bg-teal-500/20 text-teal-200 border-teal-500/40",
  PRICE: "bg-gray-500/20 text-gray-200 border-gray-500/40",
  VOLUME: "bg-emerald-500/20 text-emerald-200 border-emerald-500/40",
}

export default function StrategyBadge({ label, indicator }) {
  return (
    <span
      className={clsx(
        "inline-flex rounded-full border px-2.5 py-1 text-xs font-medium",
        COLOR_MAP[indicator] || "border-brand-400/40 bg-brand-400/20 text-brand-50",
      )}
    >
      {label}
    </span>
  )
}

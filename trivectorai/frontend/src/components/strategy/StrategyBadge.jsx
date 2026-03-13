const map = {
  SMA: "bg-blue-900/40 text-blue-300",
  EMA: "bg-blue-900/40 text-blue-300",
  RSI: "bg-orange-900/40 text-orange-300",
  MACD: "bg-purple-900/40 text-purple-300",
  BBANDS: "bg-teal-900/40 text-teal-300",
  PRICE: "bg-zinc-900/60 text-zinc-300",
  VOLUME: "bg-emerald-900/40 text-emerald-300",
  ATR: "bg-yellow-900/40 text-yellow-300",
}

export default function StrategyBadge({ indicator }) {
  return <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${map[indicator] || map.PRICE}`}>{indicator}</span>
}

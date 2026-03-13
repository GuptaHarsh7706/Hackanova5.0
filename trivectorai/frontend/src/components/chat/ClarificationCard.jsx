import Card from "../ui/Card"

export default function ClarificationCard({ missingFields = [] }) {
  return (
    <Card className="mt-2 border-amber-700/60 p-3">
      <p className="mb-2 text-sm font-semibold text-amber-300">Need a bit more info</p>
      <ul className="list-disc space-y-1 pl-4 text-xs text-[var(--text-secondary)]">
        {missingFields.includes("ticker") ? <li>Which asset? (AAPL, BTCUSDT, EURUSD)</li> : null}
        {missingFields.includes("timeframe") ? <li>What timeframe? (daily, hourly, etc.)</li> : null}
      </ul>
    </Card>
  )
}

import { Lightbulb } from "lucide-react"

import { useStrategyStore } from "../../store/useStrategyStore"
import Badge from "../ui/Badge"
import ChatMessage from "./ChatMessage"
import TypingIndicator from "./TypingIndicator"

const hints = ["Golden cross on AAPL", "RSI bounce on BTC", "MACD on TSLA"]

export default function ChatWindow({ onRunBacktest }) {
  const messages        = useStrategyStore((s) => s.messages)
  const isLoading       = useStrategyStore((s) => s.isLoading)
  const backtestLoading = useStrategyStore((s) => s.backtestLoading)
  const loadingText     = useStrategyStore((s) => s.loadingText)

  const showEmpty = messages.length === 0

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      {showEmpty ? (
        <div className="mx-auto mt-10 max-w-2xl space-y-6 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[var(--brand-900)]/40 text-2xl font-bold">T</div>
          <div>
            <h2 className="text-2xl font-semibold">Describe your trading strategy</h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">I will parse it into structured rules and run a backtest.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {hints.map((h) => (
              <button
                key={h}
                className="rounded-full border border-[var(--border-default)] px-3 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
              >
                {h}
              </button>
            ))}
          </div>
          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 text-left">
            <p className="mb-2 flex items-center gap-2 text-sm"><Lightbulb className="h-4 w-4 text-[var(--warning)]" />Tips for best results</p>
            <ul className="list-disc space-y-1 pl-4 text-xs text-[var(--text-secondary)]">
              <li>Name the asset</li>
              <li>Specify timeframe</li>
              <li>Include entry and exit conditions</li>
              <li>Add stop loss</li>
            </ul>
          </div>
        </div>
      ) : (
        <div className="mx-auto flex max-w-3xl flex-col gap-3">
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} onRunBacktest={onRunBacktest} />
          ))}
          {(isLoading || backtestLoading) ? <TypingIndicator text={loadingText} /> : null}
        </div>
      )}

      <div className="mx-auto mt-4 flex max-w-3xl justify-end">
        <Badge variant="success" dot>
          {isLoading || backtestLoading ? loadingText || "Working..." : "Awaiting input"}
        </Badge>
      </div>
    </div>
  )
}

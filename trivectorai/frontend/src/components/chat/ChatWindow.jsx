import { useEffect, useRef } from "react"
import { Lightbulb, TrendingUp, Zap, Shield } from "lucide-react"

import { useStrategyStore } from "../../store/useStrategyStore"
import Badge from "../ui/Badge"
import ChatMessage from "./ChatMessage"
import TypingIndicator from "./TypingIndicator"

const hints = [
  "Buy AAPL when 50 SMA crosses above 200 SMA",
  "RSI oversold bounce on BTC daily",
  "MACD crossover on TSLA with 2% stop loss",
  "Golden cross on ETH with 5% take profit",
]

const features = [
  { icon: TrendingUp, label: "Backtest Engine", desc: "Vectorized simulation with real market data" },
  { icon: Zap,        label: "AI Parsing",     desc: "Gemini extracts rules from plain English" },
  { icon: Shield,     label: "Risk Controls",  desc: "Auto stop-loss & position sizing" },
]

export default function ChatWindow({ onRunBacktest }) {
  const messages        = useStrategyStore((s) => s.messages)
  const isLoading       = useStrategyStore((s) => s.isLoading)
  const backtestLoading = useStrategyStore((s) => s.backtestLoading)
  const loadingText     = useStrategyStore((s) => s.loadingText)
  const setPrefill      = useStrategyStore((s) => s.setPrefillMessage)

  const bottomRef = useRef(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isLoading, backtestLoading])

  const showEmpty = messages.length === 0

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      {showEmpty ? (
        <div className="mx-auto mt-8 max-w-2xl space-y-8">
          {/* Hero */}
          <div className="text-center">
            <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-[var(--brand-600)] to-[var(--brand-900)] shadow-[var(--shadow-brand)]">
              <TrendingUp className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold">Describe your trading strategy</h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              I'll parse it into structured rules, run a backtest on real market data, and give you an AI analysis.
            </p>
          </div>

          {/* Feature pills */}
          <div className="grid grid-cols-3 gap-3">
            {features.map((f) => (
              <div key={f.label} className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-3 text-center">
                <f.icon className="mx-auto mb-1.5 h-5 w-5 text-[var(--brand-400)]" />
                <p className="text-xs font-semibold">{f.label}</p>
                <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">{f.desc}</p>
              </div>
            ))}
          </div>

          {/* Example chips */}
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
              <Lightbulb className="h-3.5 w-3.5" /> Try one of these
            </p>
            <div className="flex flex-wrap gap-2">
              {hints.map((h) => (
                <button
                  key={h}
                  className="rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs text-[var(--text-secondary)] transition-ui hover:border-[var(--brand-600)] hover:bg-[var(--brand-900)]/30 hover:text-[var(--text-primary)]"
                  onClick={() => setPrefill?.(h)}
                >
                  {h}
                </button>
              ))}
            </div>
          </div>

          {/* Tips card */}
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
            <p className="mb-2 text-xs font-semibold text-[var(--text-secondary)]">Tips for best results</p>
            <ul className="list-disc space-y-1 pl-4 text-xs text-[var(--text-muted)]">
              <li>Name the ticker (e.g. AAPL, BTC)</li>
              <li>Specify the timeframe (daily, 1h, 4h)</li>
              <li>Include entry and exit conditions</li>
              <li>Add a stop loss percentage</li>
            </ul>
          </div>
        </div>
      ) : (
        <div className="mx-auto flex max-w-3xl flex-col gap-3">
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} onRunBacktest={onRunBacktest} />
          ))}
          {(isLoading || backtestLoading) ? <TypingIndicator text={loadingText} /> : null}
          <div ref={bottomRef} />
        </div>
      )}

      {messages.length > 0 && (
        <div className="mx-auto mt-4 flex max-w-3xl justify-end">
          <Badge variant="success" dot>
            {isLoading || backtestLoading ? loadingText || "Working..." : "Awaiting input"}
          </Badge>
        </div>
      )}
    </div>
  )
}

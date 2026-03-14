import { useEffect, useRef } from "react"
import { Activity, CandlestickChart, Lightbulb, Radar, Shield } from "lucide-react"

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
  { icon: CandlestickChart, label: "MARKET ENGINE", desc: "Vectorized execution against historical bars" },
  { icon: Radar,            label: "AI PARSER",     desc: "Natural language translated into rule logic" },
  { icon: Shield,           label: "RISK CHECK",    desc: "Loss controls and sizing constraints" },
]

export default function ChatWindow({ onRunBacktest }) {
  const messages        = useStrategyStore((s) => s.messages)
  const isLoading       = useStrategyStore((s) => s.isLoading)
  const backtestLoading = useStrategyStore((s) => s.backtestLoading)
  const loadingText     = useStrategyStore((s) => s.loadingText)
  const processingSteps = useStrategyStore((s) => s.processingSteps)
  const parseDetails    = useStrategyStore((s) => s.parseDetails)
  const parseCanRun     = useStrategyStore((s) => s.parseCanRun)
  const agentTrace      = useStrategyStore((s) => s.agentTrace)
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
        <div className="mx-auto mt-3 max-w-3xl space-y-5">
          <div className="terminal-panel rounded-sm p-4">
            <div className="mb-3 flex items-center justify-between gap-3 border-b border-[var(--terminal-line)] pb-3">
              <div>
                <p className="font-mono text-[11px] text-[var(--brand-300)]">TRIVECTOR AI TERMINAL</p>
                <h2 className="mt-1 text-xl font-semibold tracking-tight">Describe your trading strategy</h2>
              </div>
              <div className="hidden items-center gap-1 rounded-sm border border-[var(--border-default)] bg-black/30 px-2 py-1 font-mono text-[10px] text-[var(--success)] md:flex">
                <Activity className="h-3 w-3" /> FEED LIVE
              </div>
            </div>
            <p className="text-sm text-[var(--text-secondary)]">
              Enter strategy logic in plain language. The agent will parse rules, validate structure, run simulation, and return a performance brief.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {features.map((f) => (
              <div key={f.label} className="terminal-panel rounded-sm p-3">
                <div className="mb-2 flex items-center gap-2 border-b border-[var(--terminal-line)] pb-1.5">
                  <f.icon className="h-4 w-4 text-[var(--brand-300)]" />
                  <p className="font-mono text-[11px] text-[var(--text-secondary)]">{f.label}</p>
                </div>
                <p className="text-xs text-[var(--text-muted)]">{f.desc}</p>
              </div>
            ))}
          </div>

          <div className="terminal-panel rounded-sm p-3">
            <p className="mb-2 flex items-center gap-1.5 font-mono text-[11px] text-[var(--text-muted)]">
              <Lightbulb className="h-3.5 w-3.5" /> Try one of these
            </p>
            <div className="flex flex-wrap gap-2">
              {hints.map((h) => (
                <button
                  key={h}
                  className="rounded-sm border border-[var(--border-default)] bg-black/20 px-3 py-1.5 text-xs text-[var(--text-secondary)] transition-ui hover:border-[var(--brand-500)] hover:text-[var(--brand-200)]"
                  onClick={() => setPrefill?.(h)}
                >
                  {h}
                </button>
              ))}
            </div>
          </div>

          <div className="terminal-panel rounded-sm p-4">
            <p className="mb-2 font-mono text-[11px] text-[var(--brand-300)]">INPUT CHECKLIST</p>
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
          {parseDetails && (parseDetails.readiness_score != null || (parseDetails.agent_assignments || []).length > 0) ? (
            <div className="terminal-panel rounded-sm p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--terminal-line)] pb-2">
                <p className="font-mono text-[11px] text-[var(--brand-300)]">AI MISSION CONTROL</p>
                <div className="flex items-center gap-2">
                  <span className={`rounded-sm border px-1.5 py-0.5 font-mono text-[10px] ${parseCanRun ? "border-emerald-700 text-emerald-300" : "border-amber-700 text-amber-300"}`}>
                    {parseCanRun ? "READY TO BACKTEST" : "INPUT REQUIRED"}
                  </span>
                  <span className="rounded-sm border border-[var(--border-default)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--text-secondary)]">
                    SCORE {parseDetails.readiness_score ?? 0}
                  </span>
                </div>
              </div>

              {parseDetails.reasoning_summary ? (
                <p className="mb-2 text-xs text-[var(--text-secondary)]">{parseDetails.reasoning_summary}</p>
              ) : null}

              {(parseDetails.agent_assignments || []).length > 0 ? (
                <div className="mb-2 grid gap-2 md:grid-cols-2">
                  {parseDetails.agent_assignments.map((agent, idx) => (
                    <div key={`${agent.agent}-${idx}`} className="rounded-sm border border-[var(--border-default)] bg-black/15 p-2">
                      <p className="font-mono text-[10px] text-[var(--brand-200)]">{agent.agent}</p>
                      <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">{agent.role}</p>
                      <p className="mt-1 text-[11px] text-[var(--text-muted)]">{agent.output}</p>
                    </div>
                  ))}
                </div>
              ) : null}

              {(parseDetails.context_profile?.research_notes || []).length > 0 ? (
                <div className="rounded-sm border border-[var(--border-default)] bg-black/15 p-2">
                  <p className="mb-1 font-mono text-[10px] text-[var(--text-muted)]">RESEARCH CONTEXT</p>
                  <div className="space-y-1 text-[11px] text-[var(--text-secondary)]">
                    {parseDetails.context_profile.research_notes.slice(0, 2).map((note, idx) => (
                      <p key={`${note}-${idx}`}>- {note}</p>
                    ))}
                  </div>
                </div>
              ) : null}

              {parseDetails.dsl_preview ? (
                <div className="mt-2 rounded-sm border border-[var(--border-default)] bg-black/20 p-2">
                  <p className="mb-1 font-mono text-[10px] text-[var(--text-muted)]">CANONICAL DSL</p>
                  <pre className="max-h-40 overflow-auto whitespace-pre-wrap font-mono text-[10px] text-[var(--text-secondary)]">{parseDetails.dsl_preview}</pre>
                </div>
              ) : null}

              {agentTrace.length > 0 ? (
                <p className="mt-2 text-[11px] text-[var(--text-muted)]">Trace: {agentTrace.join(" -> ")}</p>
              ) : null}
            </div>
          ) : null}

          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} onRunBacktest={onRunBacktest} />
          ))}
          {(isLoading || backtestLoading) ? <TypingIndicator text={loadingText} steps={processingSteps} /> : null}
          <div ref={bottomRef} />
        </div>
      )}

      {messages.length > 0 && (
        <div className="mx-auto mt-4 flex max-w-3xl justify-end">
          <Badge variant="success" dot>
            {isLoading || backtestLoading ? loadingText || "Processing feed..." : "Command input idle"}
          </Badge>
        </div>
      )}
    </div>
  )
}

import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronDown, SendHorizonal, Sparkles } from "lucide-react"

import { useStrategyStore } from "../../store/useStrategyStore"
import Button from "../ui/Button"

const EXAMPLES = [
  "Buy AAPL when 50 SMA crosses above 200 SMA on daily",
  "RSI oversold bounce on BTC with 3% stop loss",
  "MACD crossover on TSLA with 5% take profit",
  "Golden cross on ETH — short allowed, 4h timeframe",
]

export default function ChatInput({ onSubmit }) {
  const [value, setValue] = useState("")
  const [openExamples, setOpenExamples] = useState(false)
  const isLoading    = useStrategyStore((s) => s.isLoading)
  const prefill      = useStrategyStore((s) => s.prefillMessage)
  const consumePrefill = useStrategyStore((s) => s.consumePrefillMessage)
  const textareaRef  = useRef(null)

  // When a hint chip is clicked in ChatWindow, fill the input
  useEffect(() => {
    if (prefill) {
      setValue(consumePrefill())
      textareaRef.current?.focus()
    }
  }, [prefill])

  const charCount = value.length
  const over200   = charCount > 200

  const submit = () => {
    if (!value.trim() || isLoading) return
    onSubmit(value)
    setValue("")
    setOpenExamples(false)
  }

  return (
    <div className="sticky bottom-14 z-20 border-t border-[var(--terminal-line)] bg-black/85 p-3 backdrop-blur-sm md:bottom-0">
      <div className="mx-auto max-w-3xl">
        <div className="relative rounded-sm border border-[var(--border-default)] bg-[var(--bg-surface)] p-2 transition-all focus-within:border-[var(--brand-500)] focus-within:shadow-[0_0_0_2px_rgba(255,153,0,0.2)]">
          <textarea
            ref={textareaRef}
            className="min-h-[72px] w-full resize-none bg-transparent p-2 pr-14 font-mono text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none disabled:opacity-40"
            placeholder="> Enter strategy command..."
            value={value}
            disabled={isLoading}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit()
              if (e.key === "Escape") setOpenExamples(false)
            }}
          />
          <Button
            className="absolute bottom-2.5 right-2.5 h-9 w-9 rounded-sm border border-[var(--brand-700)] bg-[var(--brand-600)] p-0 text-black hover:bg-[var(--brand-500)]"
            loading={isLoading}
            onClick={submit}
            disabled={!value.trim()}
          >
            <SendHorizonal className="h-4 w-4" />
          </Button>
        </div>

        {/* Toolbar */}
        <div className="mt-1.5 flex items-center justify-between px-1 font-mono text-[11px] text-[var(--text-muted)]">
          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                className="inline-flex items-center gap-1 rounded-sm border border-transparent px-2 py-1 hover:border-[var(--border-default)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-secondary)]"
                onClick={() => setOpenExamples((s) => !s)}
              >
                <Sparkles className="h-3 w-3" /> Examples <ChevronDown className="h-3 w-3" />
              </button>
              {openExamples && (
                <div className="absolute bottom-8 left-0 z-30 w-96 rounded-sm border border-[var(--border-default)] bg-[var(--bg-elevated)] p-1.5 shadow-[var(--shadow-md)]">
                  <p className="px-2 pb-1 text-[10px] text-[var(--text-muted)]">Click to fill</p>
                  {EXAMPLES.map((item) => (
                    <button
                      key={item}
                      className="block w-full rounded-sm px-3 py-2 text-left text-xs text-[var(--text-secondary)] hover:bg-black/20 hover:text-[var(--brand-200)]"
                      onClick={() => { setValue(item); setOpenExamples(false); textareaRef.current?.focus() }}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className={over200 ? "text-[var(--warning)]" : ""}>
            {charCount > 0 ? `${charCount} chars` : "Ctrl+Enter to send"}
          </div>
        </div>
      </div>
    </div>
  )
}

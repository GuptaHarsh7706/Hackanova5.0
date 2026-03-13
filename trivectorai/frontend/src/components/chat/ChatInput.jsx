import { useEffect, useMemo, useState } from "react"
import { ChevronDown, SendHorizonal } from "lucide-react"

import { useStrategyStore } from "../../store/useStrategyStore"
import Button from "../ui/Button"

export default function ChatInput({ onSubmit }) {
  const [value, setValue] = useState("")
  const [openExamples, setOpenExamples] = useState(false)
  const isLoading = useStrategyStore((s) => s.isLoading)
  const exampleStrategies = useStrategyStore((s) => s.exampleStrategies)
  const consumePrefillMessage = useStrategyStore((s) => s.consumePrefillMessage)

  useEffect(() => {
    const prefill = consumePrefillMessage()
    if (prefill) setValue(prefill)
  }, [consumePrefillMessage])

  const over200 = useMemo(() => value.length > 200, [value.length])

  const submit = () => {
    if (!value.trim() || isLoading) return
    onSubmit(value)
    setValue("")
    setOpenExamples(false)
  }

  return (
    <div className="sticky bottom-14 z-20 border-t border-[var(--border-default)] bg-[var(--bg-base)] p-3 md:bottom-0">
      <div className="mx-auto max-w-3xl rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-2 focus-within:shadow-[0_0_0_2px_rgba(108,99,212,0.28)]">
        <div className="relative">
          <textarea
            className="min-h-[84px] w-full resize-none bg-transparent p-2 pr-12 text-sm text-[var(--text-primary)] outline-none disabled:opacity-50"
            placeholder="Describe your trading strategy..."
            value={value}
            disabled={isLoading}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit()
            }}
          />
          <Button className="absolute bottom-2 right-2 h-9 w-9 rounded-full p-0" loading={isLoading} onClick={submit}>
            <SendHorizonal className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-1 flex items-center justify-between text-xs text-[var(--text-secondary)]">
          <div className="flex items-center gap-3">
            <button className="opacity-40" disabled>
              Attach context
            </button>
            <div className="relative">
              <button className="inline-flex items-center gap-1" onClick={() => setOpenExamples((s) => !s)}>
                Examples <ChevronDown className="h-3 w-3" />
              </button>
              {openExamples ? (
                <div className="absolute bottom-6 left-0 z-30 w-80 rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] p-1">
                  {exampleStrategies.map((item) => (
                    <button
                      key={item}
                      className="block w-full rounded-md px-2 py-2 text-left text-xs hover:bg-[var(--bg-surface)]"
                      onClick={() => {
                        setValue(item)
                        setOpenExamples(false)
                      }}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div>{over200 ? `${value.length} chars` : "Cmd+Enter to send"}</div>
        </div>
      </div>
    </div>
  )
}

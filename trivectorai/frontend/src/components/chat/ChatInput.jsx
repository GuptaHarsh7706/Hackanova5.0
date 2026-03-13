import { useEffect, useMemo, useRef, useState } from "react"
import { SendHorizonal, X } from "lucide-react"

import Button from "../ui/Button"

const PLACEHOLDERS = [
  "e.g. Buy when 50 SMA crosses above 200 SMA on AAPL...",
  "e.g. RSI below 30 on BTC, sell when RSI crosses above 70...",
  "e.g. Golden cross strategy with 2% stop loss on TSLA...",
]

export default function ChatInput({ isLoading, onSubmit }) {
  const [value, setValue] = useState("")
  const [placeholderIndex, setPlaceholderIndex] = useState(0)
  const textRef = useRef(null)

  useEffect(() => {
    const t = setInterval(() => {
      setPlaceholderIndex((i) => (i + 1) % PLACEHOLDERS.length)
    }, 2800)
    return () => clearInterval(t)
  }, [])

  const placeholder = useMemo(() => PLACEHOLDERS[placeholderIndex], [placeholderIndex])

  const resize = () => {
    if (!textRef.current) {
      return
    }
    textRef.current.style.height = "auto"
    const max = 112
    textRef.current.style.height = `${Math.min(textRef.current.scrollHeight, max)}px`
    textRef.current.style.overflowY = textRef.current.scrollHeight > max ? "auto" : "hidden"
  }

  const submit = () => {
    const trimmed = value.trim()
    if (!trimmed || isLoading) {
      return
    }
    onSubmit(trimmed)
    setValue("")
    if (textRef.current) {
      textRef.current.style.height = "auto"
    }
  }

  const onKeyDown = (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey || !e.shiftKey)) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div className="border-t border-surface-border p-4">
      <div className="rounded-2xl border border-surface-border bg-surface-card p-3">
        <textarea
          ref={textRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            resize()
          }}
          onKeyDown={onKeyDown}
          disabled={isLoading}
          rows={1}
          className="max-h-28 w-full resize-none bg-transparent text-sm text-gray-100 outline-none placeholder:text-gray-500"
          placeholder={placeholder}
        />
        <div className="mt-3 flex items-center justify-between">
          <div>
            {value && (
              <button
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-surface hover:text-gray-100"
                onClick={() => setValue("")}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button onClick={submit} disabled={isLoading || !value.trim()}>
            <SendHorizonal className="mr-2 h-4 w-4" />
            Send
          </Button>
        </div>
        <p className="mt-2 text-xs text-gray-500">Press Ctrl+Enter (or Cmd+Enter) to send</p>
      </div>
    </div>
  )
}

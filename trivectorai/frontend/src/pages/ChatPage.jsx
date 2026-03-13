import { useRef } from "react"
import { useNavigate } from "react-router-dom"

import { normalizeHistoryItem, parseStrategy, runBacktest } from "../api/strategyApi"
import ChatInput from "../components/chat/ChatInput"
import ChatWindow from "../components/chat/ChatWindow"
import StrategyPanel from "../components/strategy/StrategyPanel"
import Button from "../components/ui/Button"
import { useStrategyStore } from "../store/useStrategyStore"

export default function ChatPage() {
  const navigate = useNavigate()
  const lastSendRef = useRef({ content: "", ts: 0 })

  const addMessage = useStrategyStore((s) => s.addMessage)
  const setLoading = useStrategyStore((s) => s.setLoading)
  const updateStrategy = useStrategyStore((s) => s.updateStrategy)
  const pushHistoryContext = useStrategyStore((s) => s.pushHistoryContext)
  const addToast = useStrategyStore((s) => s.addToast)
  const isLoading = useStrategyStore((s) => s.isLoading)
  const isBacktestRunning = useStrategyStore((s) => s.isBacktestRunning)
  const strategy = useStrategyStore((s) => s.strategy)
  const conversationHistory = useStrategyStore((s) => s.conversationHistory)
  const sessionId = useStrategyStore((s) => s.sessionId)
  const setSessionId = useStrategyStore((s) => s.setSessionId)
  const setBacktestRunning = useStrategyStore((s) => s.setBacktestRunning)
  const setCurrentBacktestResult = useStrategyStore((s) => s.setCurrentBacktestResult)
  const prependHistoryItem = useStrategyStore((s) => s.prependHistoryItem)
  const strategyPanelOpen = useStrategyStore((s) => s.strategyPanelOpen)
  const setStrategyPanelOpen = useStrategyStore((s) => s.setStrategyPanelOpen)
  const mobileStrategySheetOpen = useStrategyStore((s) => s.mobileStrategySheetOpen)
  const setMobileStrategySheetOpen = useStrategyStore((s) => s.setMobileStrategySheetOpen)

  const onSubmit = async (content) => {
    const now = Date.now()
    if (lastSendRef.current.content === content.trim().toLowerCase() && now - lastSendRef.current.ts < 1800) return
    lastSendRef.current = { content: content.trim().toLowerCase(), ts: now }

    addMessage("user", content)
    pushHistoryContext("user", content)
    setLoading(true)

    try {
      const res = await parseStrategy(content, conversationHistory, sessionId)
      if (res.session_id) setSessionId(res.session_id)
      addMessage("agent", res.agent_message)
      pushHistoryContext("model", res.agent_message)
      updateStrategy(res.strategy || null, res.status, res.missing_fields || [])
      setStrategyPanelOpen(true)
      if (res.status === "needs_clarification") addToast("warning", "More details needed to complete your strategy.")
      if (res.status === "ok") addToast("success", "Strategy parsed successfully.")
    } catch {
      addMessage("agent", "Something went wrong. Please try again.")
      addToast("error", "Parse failed")
      updateStrategy(null, "error", [])
    } finally {
      setLoading(false)
    }
  }

  const handleRunBacktest = async () => {
    if (!strategy || isBacktestRunning) return

    setBacktestRunning(true)
    addToast("info", "Running backtest...")

    try {
      const response = await runBacktest(strategy, sessionId)
      const historyItem = normalizeHistoryItem(response.result)
      setCurrentBacktestResult(response.result)
      prependHistoryItem(historyItem)
      addToast("success", "Backtest complete.")
      navigate(`/app/results/${response.result.strategy_id}`, { state: { result: response.result } })
    } catch (error) {
      addToast("error", error.message || "Backtest failed")
      addMessage("agent", `Backtest failed: ${error.message || "unknown error"}`)
    } finally {
      setBacktestRunning(false)
    }
  }

  return (
    <div className="flex h-[calc(100vh-56px)] pb-14 md:pb-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <ChatWindow onRunBacktest={handleRunBacktest} />
        <ChatInput onSubmit={onSubmit} />
      </div>

      {strategyPanelOpen ? <div className="hidden lg:block"><StrategyPanel onRunBacktest={handleRunBacktest} /></div> : null}

      {!strategyPanelOpen ? (
        <Button
          className="fixed bottom-20 right-4 z-30 hidden animate-float-pulse lg:inline-flex"
          onClick={() => setStrategyPanelOpen(true)}
        >
          View Strategy
        </Button>
      ) : null}

      {mobileStrategySheetOpen ? (
        <div className="fixed inset-0 z-50 bg-black/60 lg:hidden" onClick={() => setMobileStrategySheetOpen(false)}>
          <div className="absolute bottom-0 left-0 right-0 h-[80vh] rounded-t-2xl bg-[var(--bg-surface)] p-2" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-[var(--border-strong)]" />
            <div className="h-[calc(80vh-16px)]"><StrategyPanel onRunBacktest={handleRunBacktest} /></div>
          </div>
        </div>
      ) : null}

      {!isLoading && strategy ? (
        <Button className="fixed bottom-28 right-4 z-30 animate-float-pulse lg:hidden" onClick={() => setMobileStrategySheetOpen(true)}>
          View Strategy
        </Button>
      ) : null}
    </div>
  )
}

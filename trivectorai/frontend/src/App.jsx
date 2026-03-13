import axios from "axios"
import { useRef } from "react"

import { parseStrategy } from "./api/strategyApi"
import ChatInput from "./components/chat/ChatInput"
import ChatWindow from "./components/chat/ChatWindow"
import Header from "./components/layout/Header"
import Sidebar from "./components/layout/Sidebar"
import StrategyPanel from "./components/strategy/StrategyPanel"
import Button from "./components/ui/Button"
import { useStrategyStore } from "./store/useStrategyStore"

export default function App() {
  const lastSendRef = useRef({ content: "", ts: 0 })

  const {
    messages,
    isLoading,
    strategy,
    missingFields,
    parseStatus,
    conversationHistory,
    isMobilePanelOpen,
    toast,
    addMessage,
    setLoading,
    updateStrategy,
    appendToHistory,
    setMobilePanelOpen,
    showToast,
    clearToast,
    reset,
  } = useStrategyStore()

  const handleSubmit = async (content) => {
    const now = Date.now()
    const last = lastSendRef.current
    if (last.content === content.trim().toLowerCase() && now - last.ts < 1800) {
      return
    }
    lastSendRef.current = { content: content.trim().toLowerCase(), ts: now }

    if (content.toLowerCase() === "reset") {
      reset()
      return
    }

    addMessage("user", content)
    appendToHistory("user", content)
    setLoading(true)

    try {
      const response = await parseStrategy(content, conversationHistory)
      updateStrategy(response.strategy || null, response.status, response.missing_fields || [])
      addMessage("agent", response.agent_message)
      appendToHistory("model", response.agent_message)

      if (response.status === "error") {
        showToast("error", "Parser returned an error. Please refine your prompt.")
      }
    } catch (error) {
      let msg = "Something went wrong. Please try again."

      if (axios.isAxiosError(error)) {
        if (error.code === "ECONNABORTED") {
          msg = "That took too long. Please try again."
        } else if (!error.response) {
          msg = "Connection failed. Is the backend running?"
        } else if (error.response.status === 422) {
          msg = `Validation error: ${JSON.stringify(error.response.data?.detail || "Invalid request")}`
        } else if (error.response.status === 429) {
          msg = "LLM quota exceeded. Please wait a bit or check your Gemini billing/quota limits."
        } else if (error.response.status === 503) {
          msg = "LLM service is unavailable. Check your API key."
        }
      }

      addMessage("agent", msg)
      showToast("error", msg)
      updateStrategy(strategy, "error", missingFields)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-screen bg-surface text-gray-100">
      <div className="flex h-full">
        <Sidebar onNewStrategy={reset} />

        <main className="flex min-w-0 flex-1 flex-col">
          <Header onOpenMobilePanel={() => setMobilePanelOpen(true)} />
          <ChatWindow messages={messages} isLoading={isLoading} />
          <ChatInput isLoading={isLoading} onSubmit={handleSubmit} />
        </main>

        <div className="hidden md:block">
          <StrategyPanel strategy={strategy} missingFields={missingFields} />
        </div>
      </div>

      {isMobilePanelOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setMobilePanelOpen(false)}>
          <div
            className="absolute bottom-0 left-0 right-0 h-[80vh] rounded-t-2xl bg-[#0f0f13]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-surface-border px-4 py-3">
              <p className="text-sm font-semibold text-gray-200">Strategy Preview</p>
              <Button variant="ghost" onClick={() => setMobilePanelOpen(false)}>
                Close
              </Button>
            </div>
            <div className="h-[calc(80vh-56px)]">
              <StrategyPanel strategy={strategy} missingFields={missingFields} />
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-4 right-4 z-50 w-[320px] rounded-xl border border-red-400/50 bg-red-500/20 p-3 text-sm text-red-100 shadow-2xl">
          <div className="flex items-start justify-between gap-3">
            <p>{toast.message}</p>
            <button className="text-xs text-red-100/80 hover:text-white" onClick={clearToast}>
              x
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

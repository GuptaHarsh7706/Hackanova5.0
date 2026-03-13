import { useNavigate } from "react-router-dom"

import ChatInput from "../components/chat/ChatInput"
import ChatWindow from "../components/chat/ChatWindow"
import StrategyPanel from "../components/strategy/StrategyPanel"
import { useStrategyStore } from "../store/useStrategyStore"

export default function ChatPage() {
  const navigate = useNavigate()
  const { sendMessage, isLoading, messages, currentStrategy, runBacktest, backtestLoading } = useStrategyStore()

  const handleSubmit = async (text) => {
    if (!text.trim() || isLoading) return
    await sendMessage(text)
  }

  const handleRunBacktest = async () => {
    await runBacktest(navigate)
  }

  return (
    <div className="flex h-[calc(100vh-56px)] pb-14 md:pb-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <ChatWindow onRunBacktest={handleRunBacktest} />
        <ChatInput onSubmit={handleSubmit} />
      </div>

      <div className="hidden lg:block">
        <StrategyPanel onRunBacktest={handleRunBacktest} />
      </div>
    </div>
  )
}

import { useEffect, useRef } from "react"

import ChatMessage from "./ChatMessage"
import TypingIndicator from "./TypingIndicator"

export default function ChatWindow({ messages, isLoading }) {
  const endRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages, isLoading])

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-4xl py-3">
        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}
        {isLoading && <TypingIndicator />}
        <div ref={endRef} />
      </div>
    </div>
  )
}

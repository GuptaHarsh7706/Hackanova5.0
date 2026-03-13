import ReactMarkdown from "react-markdown"

import ClarificationCard from "./ClarificationCard"
import ConfirmationCard from "./ConfirmationCard"

export default function ChatMessage({ message, strategy, parseStatus, missingFields, onRunBacktest }) {
  const isUser = message.role === "user"

  return (
    <div className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`animate-message-in max-w-[80%] rounded-2xl border px-3 py-2 text-sm ${
          isUser
            ? "border-[var(--brand-700)] bg-[var(--brand-900)] text-[var(--brand-100)]"
            : "border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-primary)]"
        }`}
      >
        {!isUser ? <span className="mb-1 block text-xs font-semibold text-[var(--brand-200)]">TV</span> : null}
        <ReactMarkdown className="prose prose-invert max-w-none text-sm">{message.content}</ReactMarkdown>
        <p className="mt-1 text-right text-[11px] text-[var(--text-muted)]">{new Date(message.timestamp).toLocaleTimeString()}</p>

        {!isUser && parseStatus === "ok" ? <ConfirmationCard strategy={strategy} onRunBacktest={onRunBacktest} /> : null}
        {!isUser && parseStatus === "needs_clarification" ? <ClarificationCard missingFields={missingFields} /> : null}
      </div>
    </div>
  )
}

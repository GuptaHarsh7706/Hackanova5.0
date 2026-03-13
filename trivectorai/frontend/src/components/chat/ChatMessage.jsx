import ReactMarkdown from "react-markdown"

import ClarificationCard from "./ClarificationCard"
import ConfirmationCard from "./ConfirmationCard"

export default function ChatMessage({ message, onRunBacktest }) {
  const { role, content, type, strategy, missingFields } = message
  const isUser = role === "user"

  // Agent messages with type="confirmation" → render ConfirmationCard
  if (role === "agent" && type === "confirmation" && strategy) {
    return (
      <div className="message-bubble agent">
        <ConfirmationCard strategy={strategy} content={content} onRunBacktest={onRunBacktest} />
      </div>
    )
  }

  // Agent messages with type="clarification" → render ClarificationCard
  if (role === "agent" && type === "clarification") {
    return (
      <div className="message-bubble agent">
        <ClarificationCard
          content={content}
          missingFields={missingFields}
          partialStrategy={strategy}
        />
      </div>
    )
  }

  // Agent messages with type="error" → red border styling
  if (role === "agent" && type === "error") {
    return (
      <div className="message-bubble agent error-bubble">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    )
  }

  // Default: plain text bubble with markdown
  return (
    <div className={`message-bubble ${role}`}>
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  )
}

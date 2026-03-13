import clsx from "clsx"
import ReactMarkdown from "react-markdown"

export default function ChatMessage({ message }) {
  const isUser = message.role === "user"

  return (
    <div className={clsx("group flex px-4 py-2", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="mr-2 mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white">
          TV
        </div>
      )}
      <div
        className={clsx(
          "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed md:max-w-[72%]",
          isUser
            ? "rounded-br-sm bg-brand-600 text-white"
            : "rounded-bl-sm border border-surface-border bg-surface-card text-gray-100",
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-invert prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-code:text-brand-100">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
        <p className="mt-1 hidden text-[10px] text-gray-400 group-hover:block">
          {new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </div>
  )
}

export default function TypingIndicator() {
  return (
    <div className="max-w-[80%] rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-2">
      <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
        <span className="font-semibold text-[var(--brand-200)]">TV</span>
        <div className="flex gap-1">
          <span className="h-1.5 w-1.5 animate-typing-dot rounded-full bg-[var(--text-secondary)] [animation-delay:0ms]" />
          <span className="h-1.5 w-1.5 animate-typing-dot rounded-full bg-[var(--text-secondary)] [animation-delay:150ms]" />
          <span className="h-1.5 w-1.5 animate-typing-dot rounded-full bg-[var(--text-secondary)] [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  )
}
